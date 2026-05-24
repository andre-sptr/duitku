"""DuitKu backend API tests."""
import os
import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://wallet-watch-143.preview.emergentagent.com").rstrip("/")


# ===== Health =====
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{BASE_URL}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("app") == "DuitKu"
        assert data.get("status") == "ok"


# ===== Categories (seeded defaults) =====
class TestCategoriesSeeded:
    def test_default_categories_count(self, api, clean_state):
        r = api.get(f"{BASE_URL}/api/categories")
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 19, f"Expected 19 seeded categories, got {len(cats)}"
        expense = [c for c in cats if c["type"] == "expense"]
        income = [c for c in cats if c["type"] == "income"]
        assert len(expense) == 14
        assert len(income) == 5
        # no _id leakage
        for c in cats:
            assert "_id" not in c
            assert c["userId"] == "default"

    def test_filter_expense(self, api):
        r = api.get(f"{BASE_URL}/api/categories", params={"type": "expense"})
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 14
        assert all(c["type"] == "expense" for c in cats)

    def test_filter_income(self, api):
        r = api.get(f"{BASE_URL}/api/categories", params={"type": "income"})
        assert r.status_code == 200
        cats = r.json()
        assert len(cats) == 5
        assert all(c["type"] == "income" for c in cats)


# ===== Categories CRUD =====
class TestCategoryCRUD:
    def test_create_update_delete(self, api):
        # CREATE
        payload = {"name": "TEST_Cafe", "icon": "Coffee", "color": "#FF0000", "type": "expense"}
        r = api.post(f"{BASE_URL}/api/categories", json=payload)
        assert r.status_code == 200
        created = r.json()
        assert created["name"] == "TEST_Cafe"
        assert created["type"] == "expense"
        assert "_id" not in created
        cid = created["id"]

        # GET (verify persistence)
        r = api.get(f"{BASE_URL}/api/categories")
        ids = [c["id"] for c in r.json()]
        assert cid in ids

        # UPDATE
        r = api.put(f"{BASE_URL}/api/categories/{cid}", json={"name": "TEST_Cafe2"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Cafe2"

        # DELETE
        r = api.delete(f"{BASE_URL}/api/categories/{cid}")
        assert r.status_code == 200

        # 404 after delete
        r = api.put(f"{BASE_URL}/api/categories/{cid}", json={"name": "x"})
        assert r.status_code == 404


# ===== Accounts =====
class TestAccountsSeeded:
    def test_default_accounts(self, api, clean_state):
        r = api.get(f"{BASE_URL}/api/accounts")
        assert r.status_code == 200
        accs = r.json()
        names = [a["name"] for a in accs]
        assert "Tunai" in names
        assert "Bank" in names
        for a in accs:
            assert "_id" not in a


class TestAccountCRUD:
    def test_create_update_delete_account(self, api):
        payload = {"name": "TEST_GoPay", "icon": "Wallet", "color": "#00AA00", "balance": 50000, "type": "ewallet"}
        r = api.post(f"{BASE_URL}/api/accounts", json=payload)
        assert r.status_code == 200
        acc = r.json()
        assert acc["name"] == "TEST_GoPay"
        assert acc["balance"] == 50000
        aid = acc["id"]

        # UPDATE name
        r = api.put(f"{BASE_URL}/api/accounts/{aid}", json={"name": "TEST_GoPay2"})
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_GoPay2"

        # UPDATE balance manually
        r = api.put(f"{BASE_URL}/api/accounts/{aid}", json={"balance": 100000})
        assert r.status_code == 200
        assert r.json()["balance"] == 100000

        # DELETE
        r = api.delete(f"{BASE_URL}/api/accounts/{aid}")
        assert r.status_code == 200

        # 404 after delete
        r = api.put(f"{BASE_URL}/api/accounts/{aid}", json={"name": "x"})
        assert r.status_code == 404


# ===== Transactions & Balance Recalc =====
class TestTransactions:
    def _get_default_ids(self, api):
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        cats = api.get(f"{BASE_URL}/api/categories").json()
        tunai = next(a for a in accs if a["name"] == "Tunai")
        food = next(c for c in cats if c["type"] == "expense")
        salary = next(c for c in cats if c["type"] == "income")
        return tunai, food, salary

    def test_create_expense_updates_balance(self, api, clean_state):
        tunai, food, _ = self._get_default_ids(api)
        # Set initial balance via account update
        api.put(f"{BASE_URL}/api/accounts/{tunai['id']}", json={"balance": 100000})

        r = api.post(f"{BASE_URL}/api/transactions", json={
            "accountId": tunai["id"], "categoryId": food["id"],
            "amount": 25000, "type": "expense", "date": "2026-05-15", "note": "TEST_lunch"
        })
        assert r.status_code == 200
        tx = r.json()
        assert tx["amount"] == 25000
        assert "_id" not in tx

        # Balance should be 100000 - 25000 = 75000
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        acc = next(a for a in accs if a["id"] == tunai["id"])
        assert acc["balance"] == 75000, f"Expected 75000, got {acc['balance']}"

    def test_create_income_updates_balance(self, api):
        tunai, _, salary = self._get_default_ids(api)
        r = api.post(f"{BASE_URL}/api/transactions", json={
            "accountId": tunai["id"], "categoryId": salary["id"],
            "amount": 200000, "type": "income", "date": "2026-05-16"
        })
        assert r.status_code == 200
        # After previous test: 75000 + 200000 = 275000
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        acc = next(a for a in accs if a["id"] == tunai["id"])
        assert acc["balance"] == 275000

    def test_update_transaction_recalc(self, api):
        tunai, food, _ = self._get_default_ids(api)
        txs = api.get(f"{BASE_URL}/api/transactions", params={"accountId": tunai["id"], "type": "expense"}).json()
        tx_id = txs[0]["id"]
        # change expense amount from 25000 to 30000 -> balance 270000
        r = api.put(f"{BASE_URL}/api/transactions/{tx_id}", json={"amount": 30000})
        assert r.status_code == 200
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        acc = next(a for a in accs if a["id"] == tunai["id"])
        assert acc["balance"] == 270000

    def test_delete_transaction_recalc(self, api):
        tunai, _, _ = self._get_default_ids(api)
        txs = api.get(f"{BASE_URL}/api/transactions", params={"accountId": tunai["id"], "type": "expense"}).json()
        tx_id = txs[0]["id"]
        r = api.delete(f"{BASE_URL}/api/transactions/{tx_id}")
        assert r.status_code == 200
        # back to 300000 (100k initial + 200k income)
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        acc = next(a for a in accs if a["id"] == tunai["id"])
        assert acc["balance"] == 300000

    def test_list_filters(self, api):
        tunai, _, _ = self._get_default_ids(api)
        r = api.get(f"{BASE_URL}/api/transactions", params={"type": "income"})
        assert r.status_code == 200
        for t in r.json():
            assert t["type"] == "income"

        r = api.get(f"{BASE_URL}/api/transactions", params={"start": "2026-05-01", "end": "2026-05-31"})
        assert r.status_code == 200


# ===== Stats =====
class TestStats:
    def test_summary_expense(self, api, clean_state):
        # Seed a couple txs
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        cats = api.get(f"{BASE_URL}/api/categories", params={"type": "expense"}).json()
        a = accs[0]["id"]
        c1 = cats[0]["id"]
        c2 = cats[1]["id"]
        api.post(f"{BASE_URL}/api/transactions", json={"accountId": a, "categoryId": c1, "amount": 10000, "type": "expense", "date": "2026-05-10"})
        api.post(f"{BASE_URL}/api/transactions", json={"accountId": a, "categoryId": c2, "amount": 30000, "type": "expense", "date": "2026-05-11"})

        r = api.get(f"{BASE_URL}/api/stats/summary", params={"type": "expense", "start": "2026-05-01", "end": "2026-05-31"})
        assert r.status_code == 200
        data = r.json()
        assert data["total"] == 40000
        assert data["type"] == "expense"
        assert len(data["breakdown"]) == 2
        for b in data["breakdown"]:
            assert "percentage" in b
            assert "categoryName" in b
        # sum of percentages ~ 100
        total_pct = sum(b["percentage"] for b in data["breakdown"])
        assert abs(total_pct - 100) < 0.01

    def test_bars_month(self, api):
        r = api.get(f"{BASE_URL}/api/stats/bars", params={"granularity": "month"})
        assert r.status_code == 200
        data = r.json()
        assert data["granularity"] == "month"
        assert isinstance(data["bars"], list)
        if data["bars"]:
            b = data["bars"][0]
            assert "period" in b and "income" in b and "expense" in b and "profit" in b


# ===== Export/Reset =====
class TestExportReset:
    def test_export(self, api):
        r = api.get(f"{BASE_URL}/api/data/export")
        assert r.status_code == 200
        d = r.json()
        assert "accounts" in d and "categories" in d and "transactions" in d
        assert d.get("version") == 1
        # No _id leakage
        for k in ("accounts", "categories", "transactions"):
            for item in d[k]:
                assert "_id" not in item

    def test_reset_wipes_and_reseeds(self, api):
        r = api.post(f"{BASE_URL}/api/data/reset")
        assert r.status_code == 200
        cats = api.get(f"{BASE_URL}/api/categories").json()
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        txs = api.get(f"{BASE_URL}/api/transactions").json()
        assert len(cats) == 19
        assert len(accs) == 2
        assert len(txs) == 0


# ===== Account delete cascades transactions =====
class TestAccountCascade:
    def test_delete_account_removes_txs(self, api, clean_state):
        cats = api.get(f"{BASE_URL}/api/categories", params={"type": "expense"}).json()
        r = api.post(f"{BASE_URL}/api/accounts", json={"name": "TEST_ToDelete", "balance": 0})
        aid = r.json()["id"]
        api.post(f"{BASE_URL}/api/transactions", json={
            "accountId": aid, "categoryId": cats[0]["id"], "amount": 5000, "type": "expense", "date": "2026-05-12"
        })
        # confirm tx exists
        txs = api.get(f"{BASE_URL}/api/transactions", params={"accountId": aid}).json()
        assert len(txs) == 1
        # delete account
        api.delete(f"{BASE_URL}/api/accounts/{aid}")
        txs = api.get(f"{BASE_URL}/api/transactions", params={"accountId": aid}).json()
        assert len(txs) == 0
