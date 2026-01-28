"""
Test Stock Market Features - Iteration 31
Tests: Wallet transfer, Buy/Sell stocks, Stock detail, Admin stock management, Portfolio, Notifications
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://finlit-kids-1.preview.emergentagent.com').rstrip('/')

# Test credentials from review request
GRADE3_SESSION = "grade3_test_75f782823d034001babf"
ADMIN_SESSION = "sess_597374abce5b49f297618c21e6c838d7"


class TestWalletTransfer:
    """Test wallet transfer between spending and investing accounts"""
    
    def test_get_wallet_balance(self):
        """Get current wallet balances"""
        response = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get wallet: {response.text}"
        data = response.json()
        
        # Verify wallet structure
        assert "accounts" in data
        assert "total_balance" in data
        
        # Find spending and investing accounts
        accounts = {acc["account_type"]: acc for acc in data["accounts"]}
        assert "spending" in accounts, "Spending account not found"
        assert "investing" in accounts, "Investing account not found"
        
        print(f"✅ Wallet balances - Spending: ₹{accounts['spending']['balance']}, Investing: ₹{accounts['investing']['balance']}")
        return accounts
    
    def test_transfer_spending_to_investing(self):
        """Transfer money from spending to investing account"""
        # Get initial balances
        initial_response = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        initial_accounts = {acc["account_type"]: acc for acc in initial_response.json()["accounts"]}
        initial_spending = initial_accounts["spending"]["balance"]
        initial_investing = initial_accounts["investing"]["balance"]
        
        # Transfer ₹10 from spending to investing
        transfer_amount = 10.0
        response = requests.post(
            f"{BASE_URL}/api/wallet/transfer",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"},
            json={
                "from_account": "spending",
                "to_account": "investing",
                "amount": transfer_amount
            }
        )
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        data = response.json()
        assert "message" in data
        assert "transaction_id" in data
        
        # Verify balances changed
        final_response = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        final_accounts = {acc["account_type"]: acc for acc in final_response.json()["accounts"]}
        
        assert final_accounts["spending"]["balance"] == initial_spending - transfer_amount, "Spending balance not deducted"
        assert final_accounts["investing"]["balance"] == initial_investing + transfer_amount, "Investing balance not increased"
        
        print(f"✅ Transfer successful: ₹{transfer_amount} from spending to investing")
        print(f"   Spending: ₹{initial_spending} → ₹{final_accounts['spending']['balance']}")
        print(f"   Investing: ₹{initial_investing} → ₹{final_accounts['investing']['balance']}")
    
    def test_transfer_investing_to_spending(self):
        """Transfer money from investing back to spending"""
        # Get initial balances
        initial_response = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        initial_accounts = {acc["account_type"]: acc for acc in initial_response.json()["accounts"]}
        initial_spending = initial_accounts["spending"]["balance"]
        initial_investing = initial_accounts["investing"]["balance"]
        
        # Transfer ₹10 back from investing to spending
        transfer_amount = 10.0
        response = requests.post(
            f"{BASE_URL}/api/wallet/transfer",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"},
            json={
                "from_account": "investing",
                "to_account": "spending",
                "amount": transfer_amount
            }
        )
        assert response.status_code == 200, f"Transfer failed: {response.text}"
        
        # Verify balances changed
        final_response = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        final_accounts = {acc["account_type"]: acc for acc in final_response.json()["accounts"]}
        
        assert final_accounts["spending"]["balance"] == initial_spending + transfer_amount
        assert final_accounts["investing"]["balance"] == initial_investing - transfer_amount
        
        print(f"✅ Reverse transfer successful: ₹{transfer_amount} from investing to spending")
    
    def test_transfer_insufficient_balance(self):
        """Test transfer with insufficient balance fails"""
        response = requests.post(
            f"{BASE_URL}/api/wallet/transfer",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"},
            json={
                "from_account": "spending",
                "to_account": "investing",
                "amount": 999999.0  # Very large amount
            }
        )
        assert response.status_code == 400, f"Expected 400 for insufficient balance, got {response.status_code}"
        print("✅ Insufficient balance transfer correctly rejected")


class TestStockList:
    """Test stock list endpoint for Grade 3 user"""
    
    def test_get_stocks_list(self):
        """Get all stocks available for Grade 3 user"""
        response = requests.get(
            f"{BASE_URL}/api/stocks/list",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get stocks: {response.text}"
        stocks = response.json()
        
        assert isinstance(stocks, list), "Stocks should be a list"
        assert len(stocks) > 0, "Should have at least one stock"
        
        # Verify stock structure
        for stock in stocks:
            assert "stock_id" in stock
            assert "name" in stock
            # Some stocks use "ticker", some use "symbol"
            assert "ticker" in stock or "symbol" in stock, f"Stock {stock['name']} missing ticker/symbol"
            assert "current_price" in stock
            assert "price_change" in stock or "price_change_percent" in stock
        
        print(f"✅ Found {len(stocks)} stocks for Grade 3 user")
        for stock in stocks[:3]:  # Print first 3
            print(f"   - {stock['ticker']}: ₹{stock['current_price']}")
        
        return stocks
    
    def test_stocks_have_educational_info(self):
        """Verify stocks have educational content"""
        response = requests.get(
            f"{BASE_URL}/api/stocks/list",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        stocks = response.json()
        
        # Check at least one stock has educational info
        has_educational = any(
            stock.get("what_they_do") or stock.get("why_price_changes")
            for stock in stocks
        )
        assert has_educational, "Stocks should have educational content"
        print("✅ Stocks have educational content (what_they_do, why_price_changes)")


class TestStockDetail:
    """Test stock detail endpoint"""
    
    def test_get_stock_detail(self):
        """Get detailed info for a specific stock"""
        # First get list to find a stock_id
        list_response = requests.get(
            f"{BASE_URL}/api/stocks/list",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        stocks = list_response.json()
        stock_id = stocks[0]["stock_id"]
        
        # Get stock detail
        response = requests.get(
            f"{BASE_URL}/api/stocks/{stock_id}",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get stock detail: {response.text}"
        stock = response.json()
        
        # Verify full stock info
        assert stock["stock_id"] == stock_id
        assert "name" in stock
        assert "ticker" in stock
        assert "current_price" in stock
        assert "description" in stock or "what_they_do" in stock
        
        print(f"✅ Stock detail retrieved: {stock['ticker']} - {stock['name']}")
        print(f"   Price: ₹{stock['current_price']}")
        if stock.get("price_history"):
            print(f"   Price history entries: {len(stock['price_history'])}")
        
        return stock
    
    def test_stock_not_found(self):
        """Test 404 for non-existent stock"""
        response = requests.get(
            f"{BASE_URL}/api/stocks/nonexistent_stock_id",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✅ Non-existent stock correctly returns 404")


class TestBuyStock:
    """Test buying stocks"""
    
    def test_buy_stock_success(self):
        """Buy a stock and verify balance deduction"""
        # Get initial investing balance
        wallet_response = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        accounts = {acc["account_type"]: acc for acc in wallet_response.json()["accounts"]}
        initial_investing = accounts["investing"]["balance"]
        
        # Get a stock to buy
        stocks_response = requests.get(
            f"{BASE_URL}/api/stocks/list",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        stocks = stocks_response.json()
        stock = stocks[0]
        stock_price = stock["current_price"]
        
        # Buy 1 share
        buy_response = requests.post(
            f"{BASE_URL}/api/stocks/buy",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"},
            json={
                "stock_id": stock["stock_id"],
                "quantity": 1
            }
        )
        
        # Check if market is open
        if buy_response.status_code == 400 and "Market is closed" in buy_response.text:
            print("⚠️ Market is closed - skipping buy test (9 AM - 4 PM IST)")
            pytest.skip("Market is closed")
        
        assert buy_response.status_code == 200, f"Buy failed: {buy_response.text}"
        buy_data = buy_response.json()
        assert "message" in buy_data
        assert "total_cost" in buy_data
        
        # Verify investing balance decreased
        final_wallet = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        final_accounts = {acc["account_type"]: acc for acc in final_wallet.json()["accounts"]}
        
        expected_balance = initial_investing - stock_price
        assert abs(final_accounts["investing"]["balance"] - expected_balance) < 0.01, \
            f"Balance mismatch: expected {expected_balance}, got {final_accounts['investing']['balance']}"
        
        print(f"✅ Bought 1 share of {stock['ticker']} for ₹{stock_price}")
        print(f"   Investing balance: ₹{initial_investing} → ₹{final_accounts['investing']['balance']}")
        
        return stock
    
    def test_buy_insufficient_funds(self):
        """Test buy with insufficient funds fails"""
        # Get a stock
        stocks_response = requests.get(
            f"{BASE_URL}/api/stocks/list",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        stock = stocks_response.json()[0]
        
        # Try to buy way more than we can afford
        response = requests.post(
            f"{BASE_URL}/api/stocks/buy",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"},
            json={
                "stock_id": stock["stock_id"],
                "quantity": 99999
            }
        )
        
        # Either market closed or insufficient balance
        if response.status_code == 400:
            if "Market is closed" in response.text:
                print("⚠️ Market is closed - skipping test")
                pytest.skip("Market is closed")
            assert "Insufficient" in response.text or "balance" in response.text.lower()
            print("✅ Insufficient funds correctly rejected")
        else:
            pytest.fail(f"Expected 400, got {response.status_code}")


class TestSellStock:
    """Test selling stocks"""
    
    def test_sell_stock_success(self):
        """Sell a stock and verify balance increase"""
        # First check portfolio
        portfolio_response = requests.get(
            f"{BASE_URL}/api/stocks/portfolio",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        portfolio = portfolio_response.json()
        
        if not portfolio.get("holdings") or len(portfolio["holdings"]) == 0:
            print("⚠️ No holdings to sell - skipping sell test")
            pytest.skip("No holdings to sell")
        
        holding = portfolio["holdings"][0]
        stock_id = holding["stock_id"]
        
        # Get current investing balance
        wallet_response = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        accounts = {acc["account_type"]: acc for acc in wallet_response.json()["accounts"]}
        initial_investing = accounts["investing"]["balance"]
        
        # Get current stock price
        stock_response = requests.get(
            f"{BASE_URL}/api/stocks/{stock_id}",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        stock = stock_response.json()
        stock_price = stock["current_price"]
        
        # Sell 1 share
        sell_response = requests.post(
            f"{BASE_URL}/api/stocks/sell",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"},
            json={
                "stock_id": stock_id,
                "quantity": 1
            }
        )
        
        if sell_response.status_code == 400 and "Market is closed" in sell_response.text:
            print("⚠️ Market is closed - skipping sell test (9 AM - 4 PM IST)")
            pytest.skip("Market is closed")
        
        assert sell_response.status_code == 200, f"Sell failed: {sell_response.text}"
        sell_data = sell_response.json()
        assert "message" in sell_data
        assert "total_received" in sell_data
        
        # Verify investing balance increased
        final_wallet = requests.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        final_accounts = {acc["account_type"]: acc for acc in final_wallet.json()["accounts"]}
        
        expected_balance = initial_investing + stock_price
        assert abs(final_accounts["investing"]["balance"] - expected_balance) < 0.01, \
            f"Balance mismatch: expected {expected_balance}, got {final_accounts['investing']['balance']}"
        
        print(f"✅ Sold 1 share of {stock['ticker']} for ₹{stock_price}")
        print(f"   Investing balance: ₹{initial_investing} → ₹{final_accounts['investing']['balance']}")
    
    def test_sell_insufficient_shares(self):
        """Test sell with insufficient shares fails"""
        # Get a stock from list
        stocks_response = requests.get(
            f"{BASE_URL}/api/stocks/list",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        stock = stocks_response.json()[0]
        
        # Try to sell more than we own
        response = requests.post(
            f"{BASE_URL}/api/stocks/sell",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"},
            json={
                "stock_id": stock["stock_id"],
                "quantity": 99999
            }
        )
        
        if response.status_code == 400:
            if "Market is closed" in response.text:
                print("⚠️ Market is closed - skipping test")
                pytest.skip("Market is closed")
            assert "Insufficient" in response.text or "shares" in response.text.lower()
            print("✅ Insufficient shares correctly rejected")
        else:
            pytest.fail(f"Expected 400, got {response.status_code}")


class TestPortfolio:
    """Test portfolio endpoint"""
    
    def test_get_portfolio(self):
        """Get user's stock portfolio"""
        response = requests.get(
            f"{BASE_URL}/api/stocks/portfolio",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get portfolio: {response.text}"
        portfolio = response.json()
        
        # Verify portfolio structure
        assert "holdings" in portfolio
        assert "total_invested" in portfolio
        assert "total_current_value" in portfolio
        assert "total_profit_loss" in portfolio
        
        print(f"✅ Portfolio retrieved:")
        print(f"   Holdings: {len(portfolio['holdings'])}")
        print(f"   Total Invested: ₹{portfolio['total_invested']}")
        print(f"   Current Value: ₹{portfolio['total_current_value']}")
        print(f"   P/L: ₹{portfolio['total_profit_loss']}")
        
        # Verify holdings structure if any
        for holding in portfolio["holdings"]:
            assert "stock_id" in holding
            assert "quantity" in holding
            assert "current_value" in holding or "current_price" in holding
        
        return portfolio


class TestMarketStatus:
    """Test market status endpoint"""
    
    def test_get_market_status(self):
        """Get current market status"""
        response = requests.get(
            f"{BASE_URL}/api/stocks/market-status",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get market status: {response.text}"
        status = response.json()
        
        assert "is_open" in status
        assert "current_time" in status
        assert "open_time" in status
        assert "close_time" in status
        
        print(f"✅ Market Status:")
        print(f"   Is Open: {status['is_open']}")
        print(f"   Current Time: {status['current_time']} IST")
        print(f"   Trading Hours: {status['open_time']} - {status['close_time']}")
        
        return status


class TestAdminStockManagement:
    """Test admin stock management endpoints"""
    
    def test_admin_get_stocks(self):
        """Admin can get all stocks"""
        response = requests.get(
            f"{BASE_URL}/api/admin/investments/stocks",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get admin stocks: {response.text}"
        stocks = response.json()
        
        assert isinstance(stocks, list)
        print(f"✅ Admin retrieved {len(stocks)} stocks")
        return stocks
    
    def test_admin_create_stock(self):
        """Admin can create a new stock"""
        test_stock = {
            "name": "TEST_Stock Corp",
            "symbol": "TSTS",
            "description": "Test stock for automated testing",
            "current_price": 50.0,
            "min_price": 25.0,
            "max_price": 100.0,
            "volatility": 0.1,
            "min_grade": 3,
            "max_grade": 5
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/investments/stocks",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"},
            json=test_stock
        )
        assert response.status_code == 200, f"Failed to create stock: {response.text}"
        data = response.json()
        
        assert "stock_id" in data
        assert "message" in data
        
        print(f"✅ Admin created stock: {test_stock['name']} (ID: {data['stock_id']})")
        
        # Cleanup - delete the test stock
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/investments/stocks/{data['stock_id']}",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert delete_response.status_code == 200, f"Failed to delete test stock: {delete_response.text}"
        print(f"   Cleaned up test stock")
        
        return data
    
    def test_admin_get_stock_categories(self):
        """Admin can get stock categories"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stock-categories",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get categories: {response.text}"
        categories = response.json()
        
        assert isinstance(categories, list)
        print(f"✅ Admin retrieved {len(categories)} stock categories")
        return categories
    
    def test_admin_create_category(self):
        """Admin can create a stock category"""
        test_category = {
            "name": "TEST_Category",
            "description": "Test category for automated testing",
            "icon": "🧪",
            "color": "#FF0000"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/stock-categories",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"},
            json=test_category
        )
        assert response.status_code == 200, f"Failed to create category: {response.text}"
        data = response.json()
        
        assert "category_id" in data
        print(f"✅ Admin created category: {test_category['name']} (ID: {data['category_id']})")
        
        # Cleanup
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/stock-categories/{data['category_id']}",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert delete_response.status_code == 200
        print(f"   Cleaned up test category")
        
        return data
    
    def test_admin_get_stock_news(self):
        """Admin can get stock news"""
        response = requests.get(
            f"{BASE_URL}/api/admin/stock-news",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get news: {response.text}"
        news = response.json()
        
        assert isinstance(news, list)
        print(f"✅ Admin retrieved {len(news)} stock news items")
        return news
    
    def test_admin_create_news(self):
        """Admin can create stock news"""
        test_news = {
            "title": "TEST_News Item",
            "description": "Test news for automated testing",
            "impact_type": "positive",
            "affected_stocks": []
        }
        
        response = requests.post(
            f"{BASE_URL}/api/admin/stock-news",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"},
            json=test_news
        )
        assert response.status_code == 200, f"Failed to create news: {response.text}"
        data = response.json()
        
        assert "news_id" in data
        print(f"✅ Admin created news: {test_news['title']} (ID: {data['news_id']})")
        
        # Cleanup
        delete_response = requests.delete(
            f"{BASE_URL}/api/admin/stock-news/{data['news_id']}",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert delete_response.status_code == 200
        print(f"   Cleaned up test news")
        
        return data


class TestNotifications:
    """Test notifications for quests/chores/rewards"""
    
    def test_get_notifications(self):
        """Get user notifications"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        data = response.json()
        
        assert "notifications" in data
        assert "unread_count" in data
        
        notifications = data["notifications"]
        print(f"✅ Retrieved {len(notifications)} notifications (unread: {data['unread_count']})")
        
        # Check for quest/chore notifications
        quest_notifs = [n for n in notifications if "quest" in n.get("notification_type", "").lower()]
        chore_notifs = [n for n in notifications if "chore" in n.get("notification_type", "").lower()]
        
        print(f"   Quest notifications: {len(quest_notifs)}")
        print(f"   Chore notifications: {len(chore_notifs)}")
        
        return data
    
    def test_notification_structure(self):
        """Verify notification structure"""
        response = requests.get(
            f"{BASE_URL}/api/notifications",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        notifications = response.json()["notifications"]
        
        if notifications:
            notif = notifications[0]
            assert "notification_id" in notif
            assert "notification_type" in notif
            assert "title" in notif
            assert "message" in notif
            assert "created_at" in notif
            print(f"✅ Notification structure verified")
            print(f"   Sample: [{notif['notification_type']}] {notif['title']}")
        else:
            print("⚠️ No notifications to verify structure")


class TestChildDashboard:
    """Test child dashboard shows active quests"""
    
    def test_get_child_quests(self):
        """Get child's active quests"""
        response = requests.get(
            f"{BASE_URL}/api/child/quests-new",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get quests: {response.text}"
        quests = response.json()
        
        assert isinstance(quests, list)
        
        # Count active quests
        active_quests = [q for q in quests if q.get("status") == "active" or not q.get("completed")]
        
        print(f"✅ Child has {len(quests)} total quests, {len(active_quests)} active")
        
        # Show first 2 active quests
        for quest in active_quests[:2]:
            print(f"   - {quest.get('title', 'Untitled')} ({quest.get('creator_type', 'unknown')})")
        
        return quests


class TestStockTransactions:
    """Test stock transaction history"""
    
    def test_get_stock_transactions(self):
        """Get stock transaction history"""
        response = requests.get(
            f"{BASE_URL}/api/stocks/transactions",
            headers={"Authorization": f"Bearer {GRADE3_SESSION}"}
        )
        assert response.status_code == 200, f"Failed to get transactions: {response.text}"
        transactions = response.json()
        
        assert isinstance(transactions, list)
        print(f"✅ Retrieved {len(transactions)} stock transactions")
        
        # Show recent transactions
        for tx in transactions[:3]:
            print(f"   - {tx.get('type', 'unknown')}: {tx.get('quantity', 0)} shares of {tx.get('stock_name', 'unknown')} @ ₹{tx.get('price', 0)}")
        
        return transactions


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
