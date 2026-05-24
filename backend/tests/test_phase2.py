"""DuitKu Phase 2 backend API tests: Recurring Payments + Reminders."""
import os
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = (os.environ.get("EXPO_PUBLIC_BACKEND_URL")
            or "https://wallet-watch-143.preview.emergentagent.com").rstrip("/")


def _today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _ymd(d):
    return d.strftime("%Y-%m-%d")


# ===== Recurring Payments =====
class TestRecurringCRUD:
    def test_initial_empty(self, api, clean_state):
        r = api.get(f"{BASE_URL}/api/recurring")
        assert r.status_code == 200
        assert r.json() == []

    def test_create_defaults_dates(self, api):
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        cats = api.get(f"{BASE_URL}/api/categories", params={"type": "expense"}).json()
        tunai = next(a for a in accs if a["name"] == "Tunai")
        kuota = next(c for c in cats if c["name"] == "Kuota")
        payload = {
            "name": "TEST_Netflix",
            "amount": 54000,
            "accountId": tunai["id"],
            "categoryId": kuota["id"],
            "type": "expense",
            "frequency": "monthly",
        }
        r = api.post(f"{BASE_URL}/api/recurring", json=payload)
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["name"] == "TEST_Netflix"
        assert item["amount"] == 54000
        assert item["frequency"] == "monthly"
        assert item["isActive"] is True
        assert item["autoCreate"] is True
        assert item["startDate"] == _today()
        assert item["nextDueDate"] == _today()
        assert "_id" not in item

    def test_list_after_create(self, api):
        r = api.get(f"{BASE_URL}/api/recurring")
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 1
        for it in items:
            assert "_id" not in it

    def test_update_fields(self, api):
        items = api.get(f"{BASE_URL}/api/recurring").json()
        rid = items[0]["id"]
        r = api.put(f"{BASE_URL}/api/recurring/{rid}",
                    json={"isActive": False, "frequency": "weekly"})
        assert r.status_code == 200
        d = r.json()
        assert d["isActive"] is False
        assert d["frequency"] == "weekly"

        # verify persistence via GET
        items = api.get(f"{BASE_URL}/api/recurring").json()
        assert items[0]["isActive"] is False
        assert items[0]["frequency"] == "weekly"

    def test_delete(self, api):
        items = api.get(f"{BASE_URL}/api/recurring").json()
        rid = items[0]["id"]
        r = api.delete(f"{BASE_URL}/api/recurring/{rid}")
        assert r.status_code == 200
        items = api.get(f"{BASE_URL}/api/recurring").json()
        assert all(i["id"] != rid for i in items)

        # 404
        r = api.put(f"{BASE_URL}/api/recurring/{rid}", json={"isActive": True})
        assert r.status_code == 404


# ===== Recurring Process (auto-generates transactions) =====
class TestRecurringProcess:
    def _setup(self, api):
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        cats = api.get(f"{BASE_URL}/api/categories", params={"type": "expense"}).json()
        tunai = next(a for a in accs if a["name"] == "Tunai")
        kuota = next(c for c in cats if c["name"] == "Kuota")
        return tunai, kuota

    def test_process_creates_tx_and_advances(self, api, clean_state):
        tunai, kuota = self._setup(api)
        # Set initial balance to 100000 for verification
        api.put(f"{BASE_URL}/api/accounts/{tunai['id']}", json={"balance": 100000})

        # Create a recurring payment with startDate today => due today
        payload = {
            "name": "TEST_Netflix",
            "amount": 54000,
            "accountId": tunai["id"],
            "categoryId": kuota["id"],
            "type": "expense",
            "frequency": "monthly",
            "isActive": True,
            "autoCreate": True,
        }
        r = api.post(f"{BASE_URL}/api/recurring", json=payload)
        assert r.status_code == 200
        rid = r.json()["id"]
        assert r.json()["nextDueDate"] == _today()

        # Process
        r = api.post(f"{BASE_URL}/api/recurring/process")
        assert r.status_code == 200
        body = r.json()
        assert body["ok"] is True
        assert body["created"] >= 1

        # Tx should exist
        txs = api.get(f"{BASE_URL}/api/transactions",
                      params={"accountId": tunai["id"]}).json()
        netflix = [t for t in txs if "[Reguler] TEST_Netflix" in t.get("note", "")]
        assert len(netflix) == 1
        assert netflix[0]["amount"] == 54000
        assert netflix[0]["date"] == _today()

        # nextDueDate advanced beyond today (monthly => +1 month)
        items = api.get(f"{BASE_URL}/api/recurring").json()
        item = next(i for i in items if i["id"] == rid)
        assert item["nextDueDate"] > _today()

        # Balance recalculated: 100000 - 54000 = 46000
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        acc = next(a for a in accs if a["id"] == tunai["id"])
        assert acc["balance"] == 46000

    def test_process_idempotent(self, api):
        tunai, _ = self._setup(api)
        # Running process again should NOT create duplicates because nextDueDate already in future
        before = api.get(f"{BASE_URL}/api/transactions",
                         params={"accountId": tunai["id"]}).json()
        r = api.post(f"{BASE_URL}/api/recurring/process")
        assert r.status_code == 200
        assert r.json()["created"] == 0
        after = api.get(f"{BASE_URL}/api/transactions",
                        params={"accountId": tunai["id"]}).json()
        assert len(before) == len(after)

    def test_process_respects_isActive_false(self, api, clean_state):
        tunai, kuota = self._setup(api)
        payload = {
            "name": "TEST_Paused",
            "amount": 10000,
            "accountId": tunai["id"],
            "categoryId": kuota["id"],
            "type": "expense",
            "frequency": "daily",
            "isActive": False,
            "autoCreate": True,
        }
        api.post(f"{BASE_URL}/api/recurring", json=payload)
        r = api.post(f"{BASE_URL}/api/recurring/process")
        assert r.status_code == 200
        assert r.json()["created"] == 0

    def test_process_respects_autoCreate_false(self, api, clean_state):
        tunai, kuota = self._setup(api)
        payload = {
            "name": "TEST_NoAuto",
            "amount": 10000,
            "accountId": tunai["id"],
            "categoryId": kuota["id"],
            "type": "expense",
            "frequency": "daily",
            "isActive": True,
            "autoCreate": False,
        }
        api.post(f"{BASE_URL}/api/recurring", json=payload)
        r = api.post(f"{BASE_URL}/api/recurring/process")
        assert r.status_code == 200
        assert r.json()["created"] == 0

    def test_process_catches_up_past_dues(self, api, clean_state):
        """If startDate is 3 days ago with daily frequency, process should create 4 transactions
        (3 days ago, 2 days ago, yesterday, today)."""
        tunai, kuota = self._setup(api)
        past = _ymd(datetime.now(timezone.utc) - timedelta(days=3))
        payload = {
            "name": "TEST_Catchup",
            "amount": 1000,
            "accountId": tunai["id"],
            "categoryId": kuota["id"],
            "type": "expense",
            "frequency": "daily",
            "startDate": past,
            "isActive": True,
            "autoCreate": True,
        }
        r = api.post(f"{BASE_URL}/api/recurring", json=payload)
        assert r.status_code == 200
        rid = r.json()["id"]
        assert r.json()["nextDueDate"] == past

        r = api.post(f"{BASE_URL}/api/recurring/process")
        assert r.status_code == 200
        assert r.json()["created"] == 4  # 3 days ago + 2 + 1 + today

        # nextDueDate is tomorrow
        items = api.get(f"{BASE_URL}/api/recurring").json()
        item = next(i for i in items if i["id"] == rid)
        tomorrow = _ymd(datetime.now(timezone.utc) + timedelta(days=1))
        assert item["nextDueDate"] == tomorrow

        # Run again -> idempotent
        r = api.post(f"{BASE_URL}/api/recurring/process")
        assert r.json()["created"] == 0


# ===== Reminders =====
class TestRemindersCRUD:
    def test_initial_empty(self, api, clean_state):
        r = api.get(f"{BASE_URL}/api/reminders")
        assert r.status_code == 200
        assert r.json() == []

    def test_create(self, api):
        dt = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
        payload = {
            "title": "TEST_Bayar Listrik",
            "description": "Cek tagihan",
            "dateTime": dt,
            "repeat": "monthly",
            "isActive": True,
            "notificationId": None,
        }
        r = api.post(f"{BASE_URL}/api/reminders", json=payload)
        assert r.status_code == 200, r.text
        item = r.json()
        assert item["title"] == "TEST_Bayar Listrik"
        assert item["repeat"] == "monthly"
        assert item["isActive"] is True
        assert item["notificationId"] is None
        assert "_id" not in item

    def test_update(self, api):
        items = api.get(f"{BASE_URL}/api/reminders").json()
        rid = items[0]["id"]
        r = api.put(f"{BASE_URL}/api/reminders/{rid}",
                    json={"isActive": False, "notificationId": "notif-abc-123"})
        assert r.status_code == 200
        d = r.json()
        assert d["isActive"] is False
        assert d["notificationId"] == "notif-abc-123"

    def test_sort_by_date_ascending(self, api):
        # Add a few more with different dateTimes
        for offset_days in [5, 3, 7]:
            dt = (datetime.now(timezone.utc) + timedelta(days=offset_days)).isoformat()
            api.post(f"{BASE_URL}/api/reminders", json={
                "title": f"TEST_R{offset_days}", "dateTime": dt, "repeat": "none"
            })
        r = api.get(f"{BASE_URL}/api/reminders", params={"sort": "date"})
        assert r.status_code == 200
        items = r.json()
        dts = [it["dateTime"] for it in items]
        assert dts == sorted(dts), f"Reminders not sorted ascending by dateTime: {dts}"
        for it in items:
            assert "_id" not in it

    def test_delete(self, api):
        items = api.get(f"{BASE_URL}/api/reminders").json()
        rid = items[0]["id"]
        r = api.delete(f"{BASE_URL}/api/reminders/{rid}")
        assert r.status_code == 200

        # 404
        r = api.put(f"{BASE_URL}/api/reminders/{rid}", json={"isActive": True})
        assert r.status_code == 404


# ===== Phase 1 regression sanity =====
class TestPhase1Regression:
    def test_phase1_endpoints_alive(self, api, clean_state):
        endpoints = [
            ("/api/", "GET"),
            ("/api/accounts", "GET"),
            ("/api/categories", "GET"),
            ("/api/transactions", "GET"),
            ("/api/stats/summary?type=expense", "GET"),
            ("/api/stats/bars?granularity=month", "GET"),
            ("/api/data/export", "GET"),
        ]
        for path, _ in endpoints:
            r = api.get(f"{BASE_URL}{path}")
            assert r.status_code == 200, f"{path} failed: {r.status_code}"

        # Reset
        r = api.post(f"{BASE_URL}/api/data/reset")
        assert r.status_code == 200

        # Seeded
        cats = api.get(f"{BASE_URL}/api/categories").json()
        accs = api.get(f"{BASE_URL}/api/accounts").json()
        assert len(cats) == 19
        assert len(accs) == 2
