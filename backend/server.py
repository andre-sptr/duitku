from fastapi import FastAPI, APIRouter, HTTPException, Header, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import asyncio
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Literal
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

USER_ID = "default"  # Single-user MVP

# Shared-secret gate. When API_KEY is set (e.g. on a public deployment), every
# /api request must send a matching X-API-Key header. Empty = open (local dev).
API_KEY = os.environ.get("API_KEY", "").strip()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    if not API_KEY:
        logger.warning("API_KEY not set - the /api endpoints are OPEN. Set API_KEY before deploying publicly.")
    await ensure_indexes()
    await seed_defaults()
    yield
    client.close()


app = FastAPI(title="DuitKu API", lifespan=lifespan)


async def require_api_key(x_api_key: Optional[str] = Header(default=None)):
    if not API_KEY:
        return
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")


api_router = APIRouter(prefix="/api", dependencies=[Depends(require_api_key)])


@app.get("/")
async def health():
    return {"status": "ok"}


# ============ Models ============
class Account(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str = USER_ID
    name: str
    icon: str = "Wallet"
    color: str = "#4A8B7B"
    balance: float = 0
    type: str = "cash"  # cash/bank/ewallet/savings
    order: int = 0
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class AccountCreate(BaseModel):
    name: str
    icon: Optional[str] = "Wallet"
    color: Optional[str] = "#4A8B7B"
    balance: Optional[float] = 0
    type: Optional[str] = "cash"


class AccountUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None
    balance: Optional[float] = None
    type: Optional[str] = None


class Category(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str = USER_ID
    name: str
    icon: str = "Tag"
    color: str = "#4A8B7B"
    type: Literal["expense", "income"] = "expense"
    order: int = 0
    isDefault: bool = False
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class CategoryCreate(BaseModel):
    name: str
    icon: Optional[str] = "Tag"
    color: Optional[str] = "#4A8B7B"
    type: Literal["expense", "income"] = "expense"


class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    icon: Optional[str] = None
    color: Optional[str] = None


class Transaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str = USER_ID
    accountId: str
    categoryId: str
    amount: float
    type: Literal["expense", "income"] = "expense"
    note: str = ""
    date: str  # ISO date string YYYY-MM-DD
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class TransactionCreate(BaseModel):
    accountId: str
    categoryId: str
    amount: float
    type: Literal["expense", "income"] = "expense"
    note: Optional[str] = ""
    date: Optional[str] = None  # if None, use today


class TransactionUpdate(BaseModel):
    accountId: Optional[str] = None
    categoryId: Optional[str] = None
    amount: Optional[float] = None
    type: Optional[Literal["expense", "income"]] = None
    note: Optional[str] = None
    date: Optional[str] = None


# --- Phase 2 Models ---
Frequency = Literal["daily", "weekly", "monthly", "yearly"]


class RegularPayment(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str = USER_ID
    name: str
    amount: float
    accountId: str
    categoryId: str
    type: Literal["expense", "income"] = "expense"
    frequency: Frequency = "monthly"
    startDate: str  # YYYY-MM-DD
    nextDueDate: str  # YYYY-MM-DD
    isActive: bool = True
    autoCreate: bool = True
    note: str = ""
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class RegularPaymentCreate(BaseModel):
    name: str
    amount: float
    accountId: str
    categoryId: str
    type: Literal["expense", "income"] = "expense"
    frequency: Frequency = "monthly"
    startDate: Optional[str] = None
    isActive: bool = True
    autoCreate: bool = True
    note: Optional[str] = ""


class RegularPaymentUpdate(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    accountId: Optional[str] = None
    categoryId: Optional[str] = None
    type: Optional[Literal["expense", "income"]] = None
    frequency: Optional[Frequency] = None
    startDate: Optional[str] = None
    nextDueDate: Optional[str] = None
    isActive: Optional[bool] = None
    autoCreate: Optional[bool] = None
    note: Optional[str] = None


RepeatMode = Literal["none", "daily", "weekly", "monthly", "yearly"]


class Reminder(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    userId: str = USER_ID
    title: str
    description: str = ""
    dateTime: str  # ISO datetime
    repeat: RepeatMode = "none"
    isActive: bool = True
    notificationId: Optional[str] = None  # client-side notification handle
    createdAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class ReminderCreate(BaseModel):
    title: str
    description: Optional[str] = ""
    dateTime: str
    repeat: RepeatMode = "none"
    isActive: bool = True
    notificationId: Optional[str] = None


class ReminderUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    dateTime: Optional[str] = None
    repeat: Optional[RepeatMode] = None
    isActive: Optional[bool] = None
    notificationId: Optional[str] = None


# ============ Helpers ============
def _clean(doc: dict) -> dict:
    doc.pop("_id", None)
    return doc


async def _sum_by_type(account_id: str):
    """Return (income_total, expense_total) across an account's transactions."""
    pipeline = [
        {"$match": {"userId": USER_ID, "accountId": account_id}},
        {"$group": {"_id": "$type", "total": {"$sum": "$amount"}}},
    ]
    income = 0.0
    expense = 0.0
    async for row in db.transactions.aggregate(pipeline):
        if row["_id"] == "income":
            income = float(row["total"])
        elif row["_id"] == "expense":
            expense = float(row["total"])
    return income, expense


async def _recalc_account_balance(account_id: str):
    """Recompute account balance from transactions."""
    income, expense = await _sum_by_type(account_id)
    # Get initial balance stored on account meta (we treat current balance as initial + income - expense)
    acc = await db.accounts.find_one({"id": account_id, "userId": USER_ID}, {"_id": 0})
    if not acc:
        return
    initial = float(acc.get("initialBalance", acc.get("balance", 0)))
    if "initialBalance" not in acc:
        # First time: lock the current balance as initial
        await db.accounts.update_one(
            {"id": account_id, "userId": USER_ID},
            {"$set": {"initialBalance": initial}},
        )
    new_balance = initial + income - expense
    await db.accounts.update_one(
        {"id": account_id, "userId": USER_ID},
        {"$set": {"balance": new_balance}},
    )


async def _ensure_account_exists(account_id: str):
    found = await db.accounts.find_one({"id": account_id, "userId": USER_ID}, {"_id": 1})
    if not found:
        raise HTTPException(400, "Rekening tidak ditemukan")


async def _ensure_category_exists(category_id: str):
    found = await db.categories.find_one({"id": category_id, "userId": USER_ID}, {"_id": 1})
    if not found:
        raise HTTPException(400, "Kategori tidak ditemukan")


# ============ Seed ============
DEFAULT_EXPENSE_CATS = [
    ("Makanan", "Utensils", "#4CAF50"),
    ("Bensin", "Fuel", "#4A8B7B"),
    ("Laundry", "Shirt", "#FFC107"),
    ("Kafe", "Coffee", "#9C27B0"),
    ("Dapur", "ChefHat", "#7E57C2"),
    ("Sabun", "Sparkles", "#26A69A"),
    ("Date", "Heart", "#EC407A"),
    ("Kuota", "Wifi", "#E24B4A"),
    ("Kos", "Home", "#7E57C2"),
    ("Service", "Wrench", "#42A5F5"),
    ("Infak", "HandHeart", "#42A5F5"),
    ("Tf Mama", "Send", "#5C6BC0"),
    ("Hutang", "AlertCircle", "#E24B4A"),
    ("Lainnya", "MoreHorizontal", "#757575"),
]
DEFAULT_INCOME_CATS = [
    ("Gaji", "Briefcase", "#4CAF50"),
    ("Bonus", "Award", "#FFC107"),
    ("Hadiah", "Gift", "#EC407A"),
    ("Investasi", "TrendingUp", "#42A5F5"),
    ("Lainnya", "MoreHorizontal", "#757575"),
]


async def ensure_indexes():
    # Created concurrently to keep startup fast (matters for cold starts).
    await asyncio.gather(
        db.transactions.create_index("id"),
        db.transactions.create_index([("userId", 1), ("date", -1)]),
        db.transactions.create_index([("userId", 1), ("accountId", 1)]),
        db.accounts.create_index("id"),
        db.accounts.create_index([("userId", 1), ("order", 1)]),
        db.categories.create_index("id"),
        db.categories.create_index([("userId", 1), ("type", 1), ("order", 1)]),
        db.recurring.create_index([("userId", 1), ("nextDueDate", 1)]),
        db.reminders.create_index([("userId", 1), ("dateTime", 1)]),
    )


async def seed_defaults():
    cat_count = await db.categories.count_documents({"userId": USER_ID})
    if cat_count == 0:
        docs = []
        for i, (name, icon, color) in enumerate(DEFAULT_EXPENSE_CATS):
            docs.append(Category(name=name, icon=icon, color=color, type="expense", order=i, isDefault=True).dict())
        for i, (name, icon, color) in enumerate(DEFAULT_INCOME_CATS):
            docs.append(Category(name=name, icon=icon, color=color, type="income", order=i, isDefault=True).dict())
        await db.categories.insert_many(docs)
        logging.info(f"Seeded {len(docs)} default categories")

    acc_count = await db.accounts.count_documents({"userId": USER_ID})
    if acc_count == 0:
        defaults = [
            Account(name="Tunai", icon="Wallet", color="#4A8B7B", type="cash", order=0).dict(),
            Account(name="Bank", icon="Landmark", color="#42A5F5", type="bank", order=1).dict(),
        ]
        for d in defaults:
            d["initialBalance"] = 0
        await db.accounts.insert_many(defaults)
        logging.info("Seeded default accounts")


# ============ Routes ============
@api_router.get("/")
async def root():
    return {"app": "DuitKu", "status": "ok"}


# --- Accounts ---
@api_router.get("/accounts", response_model=List[Account])
async def list_accounts():
    docs = await db.accounts.find({"userId": USER_ID}, {"_id": 0}).sort("order", 1).to_list(1000)
    return [Account(**_clean(d)) for d in docs]


@api_router.post("/accounts", response_model=Account)
async def create_account(payload: AccountCreate):
    count = await db.accounts.count_documents({"userId": USER_ID})
    acc = Account(**payload.dict(), order=count)
    doc = acc.dict()
    doc["initialBalance"] = float(payload.balance or 0)
    await db.accounts.insert_one(doc)
    return acc


@api_router.put("/accounts/{account_id}", response_model=Account)
async def update_account(account_id: str, payload: AccountUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    if "balance" in update:
        # Manual balance edit -> adjust initialBalance to honor the new value
        current = await db.accounts.find_one({"id": account_id, "userId": USER_ID}, {"_id": 0})
        if not current:
            raise HTTPException(404, "Account not found")
        # Compute tx delta
        income, expense = await _sum_by_type(account_id)
        update["initialBalance"] = float(update["balance"]) - income + expense
    res = await db.accounts.update_one(
        {"id": account_id, "userId": USER_ID}, {"$set": update}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Account not found")
    doc = await db.accounts.find_one({"id": account_id, "userId": USER_ID}, {"_id": 0})
    return Account(**_clean(doc))


@api_router.delete("/accounts/{account_id}")
async def delete_account(account_id: str):
    # Delete account and its transactions
    await db.transactions.delete_many({"userId": USER_ID, "accountId": account_id})
    res = await db.accounts.delete_one({"id": account_id, "userId": USER_ID})
    if res.deleted_count == 0:
        raise HTTPException(404, "Account not found")
    return {"ok": True}


# --- Categories ---
@api_router.get("/categories", response_model=List[Category])
async def list_categories(type: Optional[str] = None):
    q = {"userId": USER_ID}
    if type in ("expense", "income"):
        q["type"] = type
    docs = await db.categories.find(q, {"_id": 0}).sort("order", 1).to_list(1000)
    return [Category(**_clean(d)) for d in docs]


@api_router.post("/categories", response_model=Category)
async def create_category(payload: CategoryCreate):
    count = await db.categories.count_documents({"userId": USER_ID, "type": payload.type})
    cat = Category(**payload.dict(), order=count)
    await db.categories.insert_one(cat.dict())
    return cat


@api_router.put("/categories/{category_id}", response_model=Category)
async def update_category(category_id: str, payload: CategoryUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    res = await db.categories.update_one(
        {"id": category_id, "userId": USER_ID}, {"$set": update}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Category not found")
    doc = await db.categories.find_one({"id": category_id, "userId": USER_ID}, {"_id": 0})
    return Category(**_clean(doc))


@api_router.delete("/categories/{category_id}")
async def delete_category(category_id: str):
    res = await db.categories.delete_one({"id": category_id, "userId": USER_ID})
    if res.deleted_count == 0:
        raise HTTPException(404, "Category not found")
    return {"ok": True}


# --- Transactions ---
@api_router.get("/transactions", response_model=List[Transaction])
async def list_transactions(
    type: Optional[str] = None,
    accountId: Optional[str] = None,
    categoryId: Optional[str] = None,
    start: Optional[str] = None,
    end: Optional[str] = None,
    limit: int = 1000,
):
    q: dict = {"userId": USER_ID}
    if type in ("expense", "income"):
        q["type"] = type
    if accountId:
        q["accountId"] = accountId
    if categoryId:
        q["categoryId"] = categoryId
    if start or end:
        date_q = {}
        if start:
            date_q["$gte"] = start
        if end:
            date_q["$lte"] = end
        q["date"] = date_q
    docs = await db.transactions.find(q, {"_id": 0}).sort("date", -1).to_list(limit)
    return [Transaction(**_clean(d)) for d in docs]


@api_router.post("/transactions", response_model=Transaction)
async def create_transaction(payload: TransactionCreate):
    await _ensure_account_exists(payload.accountId)
    await _ensure_category_exists(payload.categoryId)
    data = payload.dict()
    if not data.get("date"):
        data["date"] = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    tx = Transaction(**data)
    await db.transactions.insert_one(tx.dict())
    await _recalc_account_balance(tx.accountId)
    return tx


@api_router.put("/transactions/{transaction_id}", response_model=Transaction)
async def update_transaction(transaction_id: str, payload: TransactionUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    existing = await db.transactions.find_one({"id": transaction_id, "userId": USER_ID}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Transaction not found")
    if "accountId" in update:
        await _ensure_account_exists(update["accountId"])
    if "categoryId" in update:
        await _ensure_category_exists(update["categoryId"])
    res = await db.transactions.update_one(
        {"id": transaction_id, "userId": USER_ID}, {"$set": update}
    )
    _ = res
    doc = await db.transactions.find_one({"id": transaction_id, "userId": USER_ID}, {"_id": 0})
    # Recalc both old and new account if changed
    await _recalc_account_balance(existing["accountId"])
    if update.get("accountId") and update["accountId"] != existing["accountId"]:
        await _recalc_account_balance(update["accountId"])
    return Transaction(**_clean(doc))


@api_router.delete("/transactions/{transaction_id}")
async def delete_transaction(transaction_id: str):
    existing = await db.transactions.find_one({"id": transaction_id, "userId": USER_ID}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Transaction not found")
    await db.transactions.delete_one({"id": transaction_id, "userId": USER_ID})
    await _recalc_account_balance(existing["accountId"])
    return {"ok": True}


# --- Stats ---
@api_router.get("/stats/summary")
async def stats_summary(
    type: Literal["expense", "income"] = "expense",
    start: Optional[str] = None,
    end: Optional[str] = None,
):
    q: dict = {"userId": USER_ID, "type": type}
    if start or end:
        date_q = {}
        if start:
            date_q["$gte"] = start
        if end:
            date_q["$lte"] = end
        q["date"] = date_q
    pipeline = [
        {"$match": q},
        {"$group": {
            "_id": "$categoryId",
            "total": {"$sum": "$amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"total": -1}},
    ]
    cat_docs = await db.categories.find({"userId": USER_ID}, {"_id": 0}).to_list(1000)
    cat_map = {c["id"]: c for c in cat_docs}
    result = []
    total = 0.0
    async for row in db.transactions.aggregate(pipeline):
        cat_id = row["_id"]
        cat = cat_map.get(cat_id)
        amount = float(row["total"])
        total += amount
        result.append({
            "categoryId": cat_id,
            "categoryName": cat["name"] if cat else "Lainnya",
            "categoryIcon": cat["icon"] if cat else "Tag",
            "categoryColor": cat["color"] if cat else "#757575",
            "amount": amount,
            "count": row["count"],
        })
    for r in result:
        r["percentage"] = (r["amount"] / total * 100) if total > 0 else 0
    return {"total": total, "type": type, "breakdown": result}


@api_router.get("/stats/bars")
async def stats_bars(
    granularity: Literal["day", "week", "month", "year"] = "month",
    start: Optional[str] = None,
    end: Optional[str] = None,
):
    """Return income/expense aggregates over time."""
    q: dict = {"userId": USER_ID}
    if start or end:
        date_q = {}
        if start:
            date_q["$gte"] = start
        if end:
            date_q["$lte"] = end
        q["date"] = date_q
    docs = await db.transactions.find(q, {"_id": 0}).to_list(10000)
    buckets: dict = {}
    for d in docs:
        date_str = d["date"]  # YYYY-MM-DD
        try:
            dt = datetime.strptime(date_str, "%Y-%m-%d")
        except Exception:
            continue
        if granularity == "year":
            key = dt.strftime("%Y")
        elif granularity == "month":
            key = dt.strftime("%Y-%m")
        elif granularity == "week":
            iso = dt.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
        else:
            key = date_str
        b = buckets.setdefault(key, {"period": key, "income": 0.0, "expense": 0.0})
        if d["type"] == "income":
            b["income"] += float(d["amount"])
        else:
            b["expense"] += float(d["amount"])
    result = sorted(buckets.values(), key=lambda x: x["period"])
    for r in result:
        r["profit"] = r["income"] - r["expense"]
    return {"granularity": granularity, "bars": result}


@api_router.post("/data/reset")
async def reset_all_data():
    await db.transactions.delete_many({"userId": USER_ID})
    await db.accounts.delete_many({"userId": USER_ID})
    await db.categories.delete_many({"userId": USER_ID})
    await db.recurring.delete_many({"userId": USER_ID})
    await db.reminders.delete_many({"userId": USER_ID})
    await seed_defaults()
    return {"ok": True}


@api_router.get("/data/export")
async def export_data():
    accounts = await db.accounts.find({"userId": USER_ID}, {"_id": 0}).to_list(1000)
    categories = await db.categories.find({"userId": USER_ID}, {"_id": 0}).to_list(1000)
    transactions = await db.transactions.find({"userId": USER_ID}, {"_id": 0}).to_list(10000)
    recurring = await db.recurring.find({"userId": USER_ID}, {"_id": 0}).to_list(1000)
    reminders = await db.reminders.find({"userId": USER_ID}, {"_id": 0}).to_list(1000)
    return {
        "version": 2,
        "exportedAt": datetime.now(timezone.utc).isoformat(),
        "accounts": accounts,
        "categories": categories,
        "transactions": transactions,
        "recurring": recurring,
        "reminders": reminders,
    }


class ImportPayload(BaseModel):
    accounts: List[dict] = []
    categories: List[dict] = []
    transactions: List[dict] = []
    recurring: List[dict] = []
    reminders: List[dict] = []


@api_router.post("/data/import")
async def import_data(payload: ImportPayload):
    """Replace ALL current data with the contents of a backup (restore)."""
    def _stamp(items):
        cleaned = []
        for it in items:
            doc = {k: v for k, v in it.items() if k != "_id"}
            doc["userId"] = USER_ID
            cleaned.append(doc)
        return cleaned

    accounts = _stamp(payload.accounts)
    categories = _stamp(payload.categories)
    transactions = _stamp(payload.transactions)
    recurring = _stamp(payload.recurring)
    reminders = _stamp(payload.reminders)

    # Wipe current data, then restore from the backup.
    await db.transactions.delete_many({"userId": USER_ID})
    await db.accounts.delete_many({"userId": USER_ID})
    await db.categories.delete_many({"userId": USER_ID})
    await db.recurring.delete_many({"userId": USER_ID})
    await db.reminders.delete_many({"userId": USER_ID})

    if accounts:
        await db.accounts.insert_many(accounts)
    if categories:
        await db.categories.insert_many(categories)
    if transactions:
        await db.transactions.insert_many(transactions)
    if recurring:
        await db.recurring.insert_many(recurring)
    if reminders:
        await db.reminders.insert_many(reminders)

    # Recompute balances from the restored transactions.
    for acc in accounts:
        if acc.get("id"):
            await _recalc_account_balance(acc["id"])

    return {
        "ok": True,
        "accounts": len(accounts),
        "categories": len(categories),
        "transactions": len(transactions),
        "recurring": len(recurring),
        "reminders": len(reminders),
    }


# --- Phase 2 Helpers ---
def _advance_date(iso: str, freq: str) -> str:
    d = datetime.strptime(iso, "%Y-%m-%d")
    if freq == "daily":
        d = d + timedelta(days=1)
    elif freq == "weekly":
        d = d + timedelta(days=7)
    elif freq == "monthly":
        # add 1 month, clamping day
        year = d.year + (d.month // 12)
        month = (d.month % 12) + 1
        # find last day of new month
        if month == 12:
            last_next = (datetime(year + 1, 1, 1) - timedelta(days=1)).day
        else:
            last_next = (datetime(year, month + 1, 1) - timedelta(days=1)).day
        day = min(d.day, last_next)
        d = datetime(year, month, day)
    elif freq == "yearly":
        try:
            d = d.replace(year=d.year + 1)
        except ValueError:
            d = d.replace(year=d.year + 1, day=28)
    return d.strftime("%Y-%m-%d")


# --- Regular Payments ---
@api_router.get("/recurring", response_model=List[RegularPayment])
async def list_recurring():
    docs = await db.recurring.find({"userId": USER_ID}, {"_id": 0}).sort("nextDueDate", 1).to_list(1000)
    return [RegularPayment(**_clean(d)) for d in docs]


@api_router.post("/recurring", response_model=RegularPayment)
async def create_recurring(payload: RegularPaymentCreate):
    await _ensure_account_exists(payload.accountId)
    await _ensure_category_exists(payload.categoryId)
    data = payload.dict()
    start = data.get("startDate") or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    data["startDate"] = start
    data["nextDueDate"] = start
    item = RegularPayment(**data)
    await db.recurring.insert_one(item.dict())
    return item


@api_router.put("/recurring/{item_id}", response_model=RegularPayment)
async def update_recurring(item_id: str, payload: RegularPaymentUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    if "accountId" in update:
        await _ensure_account_exists(update["accountId"])
    if "categoryId" in update:
        await _ensure_category_exists(update["categoryId"])
    res = await db.recurring.update_one(
        {"id": item_id, "userId": USER_ID}, {"$set": update}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Pembayaran reguler tidak ditemukan")
    doc = await db.recurring.find_one({"id": item_id, "userId": USER_ID}, {"_id": 0})
    return RegularPayment(**_clean(doc))


@api_router.delete("/recurring/{item_id}")
async def delete_recurring(item_id: str):
    res = await db.recurring.delete_one({"id": item_id, "userId": USER_ID})
    if res.deleted_count == 0:
        raise HTTPException(404, "Pembayaran reguler tidak ditemukan")
    return {"ok": True}


@api_router.post("/recurring/process")
async def process_recurring():
    """Generate transactions for any due recurring payments and advance their nextDueDate."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    created = 0
    affected_accounts: set = set()
    cursor = db.recurring.find({"userId": USER_ID, "isActive": True}, {"_id": 0})
    async for raw in cursor:
        item = RegularPayment(**_clean(raw))
        if not item.autoCreate:
            continue
        # Loop until nextDueDate is in the future
        guard = 0
        while item.nextDueDate <= today and guard < 60:
            tx = Transaction(
                accountId=item.accountId,
                categoryId=item.categoryId,
                amount=item.amount,
                type=item.type,
                note=f"[Reguler] {item.name}",
                date=item.nextDueDate,
            )
            await db.transactions.insert_one(tx.dict())
            affected_accounts.add(item.accountId)
            created += 1
            item.nextDueDate = _advance_date(item.nextDueDate, item.frequency)
            guard += 1
        await db.recurring.update_one(
            {"id": item.id, "userId": USER_ID},
            {"$set": {"nextDueDate": item.nextDueDate}},
        )
    for acc_id in affected_accounts:
        await _recalc_account_balance(acc_id)
    return {"ok": True, "created": created}


# --- Reminders ---
@api_router.get("/reminders", response_model=List[Reminder])
async def list_reminders(sort: Literal["date", "priority"] = "date"):
    sort_field = "dateTime" if sort == "date" else "createdAt"
    docs = await db.reminders.find({"userId": USER_ID}, {"_id": 0}).sort(sort_field, 1).to_list(1000)
    return [Reminder(**_clean(d)) for d in docs]


@api_router.post("/reminders", response_model=Reminder)
async def create_reminder(payload: ReminderCreate):
    item = Reminder(**payload.dict())
    await db.reminders.insert_one(item.dict())
    return item


@api_router.put("/reminders/{item_id}", response_model=Reminder)
async def update_reminder(item_id: str, payload: ReminderUpdate):
    update = {k: v for k, v in payload.dict().items() if v is not None}
    if not update:
        raise HTTPException(400, "No fields to update")
    res = await db.reminders.update_one(
        {"id": item_id, "userId": USER_ID}, {"$set": update}
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Pengingat tidak ditemukan")
    doc = await db.reminders.find_one({"id": item_id, "userId": USER_ID}, {"_id": 0})
    return Reminder(**_clean(doc))


@api_router.delete("/reminders/{item_id}")
async def delete_reminder(item_id: str):
    res = await db.reminders.delete_one({"id": item_id, "userId": USER_ID})
    if res.deleted_count == 0:
        raise HTTPException(404, "Pengingat tidak ditemukan")
    return {"ok": True}


# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
