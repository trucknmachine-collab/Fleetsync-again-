#!/usr/bin/env python3
"""
Weekly Timesheet API Backend Tests
Tests all API endpoints with comprehensive test cases including edge cases.
"""

import requests
import json
from datetime import datetime, timedelta
from typing import Dict, Any

# Configuration
BASE_URL = "https://timesheet-ops.preview.emergentagent.com/api"
HEADERS = {"Content-Type": "application/json"}

class TimesheetAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.headers = HEADERS
        self.test_results = []
        self.created_entries = []  # Track created entries for cleanup
        
    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        status = "✅ PASS" if success else "❌ FAIL"
        result = f"{status} {test_name}"
        if details:
            result += f" - {details}"
        print(result)
        self.test_results.append({
            "test": test_name,
            "success": success,
            "details": details
        })
        
    def test_root_endpoint(self):
        """Test GET /api/ - Root endpoint should return welcome message"""
        try:
            response = requests.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if "Weekly Timesheet API" in data.get("message", ""):
                    self.log_result("Root Endpoint", True, "Returns correct welcome message")
                else:
                    self.log_result("Root Endpoint", False, f"Unexpected message: {data}")
            else:
                self.log_result("Root Endpoint", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Root Endpoint", False, f"Exception: {str(e)}")
    
    def create_test_entry_data(self, date_str: str) -> Dict[str, Any]:
        """Create test entry data with realistic values"""
        return {
            "date": date_str,
            "worker_name": "John Smith",
            "pre_start_checklist": [
                {"name": "Lights", "passed": True, "defects": ""},
                {"name": "Brakes", "passed": True, "defects": ""},
                {"name": "Tyres", "passed": False, "defects": "Front left tyre needs air"},
                {"name": "Fluids", "passed": True, "defects": ""},
                {"name": "Mirrors", "passed": True, "defects": ""},
                {"name": "Seatbelts", "passed": True, "defects": ""}
            ],
            "pre_start_completed": True,
            "start_time": "07:00",
            "end_time": "17:30",
            "break_duration": 60,
            "total_hours": 9.5,
            "overtime_hours": 1.5,
            "job_project": "Site Construction Project Alpha",
            "engine_hours_start": 1245.5,
            "engine_hours_end": 1255.0,
            "location": {
                "latitude": -33.8688,
                "longitude": 151.2093,
                "address": "Sydney Opera House, Sydney NSW 2000"
            },
            "notes": "Completed foundation work. Minor tyre issue noted in pre-start check."
        }
    
    def test_create_entry(self):
        """Test POST /api/entries - Create a new daily entry"""
        test_date = "2024-01-15"
        entry_data = self.create_test_entry_data(test_date)
        
        try:
            response = requests.post(
                f"{self.base_url}/entries",
                json=entry_data,
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                # Verify all required fields are present
                required_fields = ["id", "date", "worker_name", "pre_start_checklist"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields and data["date"] == test_date:
                    self.created_entries.append(test_date)
                    self.log_result("Create Entry", True, f"Entry created successfully with ID: {data.get('id', 'N/A')}")
                else:
                    self.log_result("Create Entry", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("Create Entry", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Create Entry", False, f"Exception: {str(e)}")
    
    def test_create_duplicate_entry(self):
        """Test creating duplicate entry for same date (should fail)"""
        test_date = "2024-01-16"
        entry_data = self.create_test_entry_data(test_date)
        
        try:
            # Create first entry
            response1 = requests.post(
                f"{self.base_url}/entries",
                json=entry_data,
                headers=self.headers
            )
            
            if response1.status_code == 200:
                self.created_entries.append(test_date)
                
                # Try to create duplicate
                response2 = requests.post(
                    f"{self.base_url}/entries",
                    json=entry_data,
                    headers=self.headers
                )
                
                if response2.status_code == 400:
                    self.log_result("Create Duplicate Entry", True, "Correctly rejected duplicate entry")
                else:
                    self.log_result("Create Duplicate Entry", False, f"Should return 400, got {response2.status_code}")
            else:
                self.log_result("Create Duplicate Entry", False, f"Failed to create first entry: {response1.status_code}")
        except Exception as e:
            self.log_result("Create Duplicate Entry", False, f"Exception: {str(e)}")
    
    def test_get_all_entries(self):
        """Test GET /api/entries - Get all entries with optional date filters"""
        try:
            # Test getting all entries
            response = requests.get(f"{self.base_url}/entries")
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get All Entries", True, f"Retrieved {len(data)} entries")
                    
                    # Test with date filters if we have created entries
                    if self.created_entries:
                        # Test start_date filter
                        response_filtered = requests.get(
                            f"{self.base_url}/entries",
                            params={"start_date": "2024-01-01", "end_date": "2024-12-31"}
                        )
                        
                        if response_filtered.status_code == 200:
                            filtered_data = response_filtered.json()
                            self.log_result("Get Entries with Date Filter", True, f"Retrieved {len(filtered_data)} filtered entries")
                        else:
                            self.log_result("Get Entries with Date Filter", False, f"Status {response_filtered.status_code}")
                else:
                    self.log_result("Get All Entries", False, "Response is not a list")
            else:
                self.log_result("Get All Entries", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Get All Entries", False, f"Exception: {str(e)}")
    
    def test_get_entry_by_date(self):
        """Test GET /api/entries/{date} - Get a specific entry by date"""
        if not self.created_entries:
            self.log_result("Get Entry by Date", False, "No created entries to test with")
            return
        
        test_date = self.created_entries[0]
        
        try:
            response = requests.get(f"{self.base_url}/entries/{test_date}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("date") == test_date:
                    self.log_result("Get Entry by Date", True, f"Retrieved entry for {test_date}")
                else:
                    self.log_result("Get Entry by Date", False, f"Date mismatch: expected {test_date}, got {data.get('date')}")
            else:
                self.log_result("Get Entry by Date", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Get Entry by Date", False, f"Exception: {str(e)}")
    
    def test_get_nonexistent_entry(self):
        """Test getting non-existent entry (should return 404)"""
        nonexistent_date = "2099-12-31"
        
        try:
            response = requests.get(f"{self.base_url}/entries/{nonexistent_date}")
            
            if response.status_code == 404:
                self.log_result("Get Non-existent Entry", True, "Correctly returned 404 for non-existent entry")
            else:
                self.log_result("Get Non-existent Entry", False, f"Should return 404, got {response.status_code}")
        except Exception as e:
            self.log_result("Get Non-existent Entry", False, f"Exception: {str(e)}")
    
    def test_update_entry(self):
        """Test PUT /api/entries/{date} - Update an existing entry"""
        if not self.created_entries:
            self.log_result("Update Entry", False, "No created entries to test with")
            return
        
        test_date = self.created_entries[0]
        update_data = {
            "worker_name": "Jane Doe Updated",
            "total_hours": 8.0,
            "overtime_hours": 0.0,
            "notes": "Updated entry with new hours and notes"
        }
        
        try:
            response = requests.put(
                f"{self.base_url}/entries/{test_date}",
                json=update_data,
                headers=self.headers
            )
            
            if response.status_code == 200:
                data = response.json()
                if (data.get("worker_name") == update_data["worker_name"] and 
                    data.get("total_hours") == update_data["total_hours"]):
                    self.log_result("Update Entry", True, f"Successfully updated entry for {test_date}")
                else:
                    self.log_result("Update Entry", False, "Update data not reflected in response")
            else:
                self.log_result("Update Entry", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Update Entry", False, f"Exception: {str(e)}")
    
    def test_update_nonexistent_entry(self):
        """Test updating non-existent entry (should return 404)"""
        nonexistent_date = "2099-12-30"
        update_data = {"worker_name": "Should Fail"}
        
        try:
            response = requests.put(
                f"{self.base_url}/entries/{nonexistent_date}",
                json=update_data,
                headers=self.headers
            )
            
            if response.status_code == 404:
                self.log_result("Update Non-existent Entry", True, "Correctly returned 404 for non-existent entry")
            else:
                self.log_result("Update Non-existent Entry", False, f"Should return 404, got {response.status_code}")
        except Exception as e:
            self.log_result("Update Non-existent Entry", False, f"Exception: {str(e)}")
    
    def test_weekly_summary(self):
        """Test GET /api/weekly-summary?week_start={date}&week_end={date} - Get weekly summary"""
        week_start = "2024-01-01"
        week_end = "2024-01-31"
        
        try:
            response = requests.get(
                f"{self.base_url}/weekly-summary",
                params={"week_start": week_start, "week_end": week_end}
            )
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ["week_start", "week_end", "total_hours", "total_overtime", "days_worked", "entries"]
                missing_fields = [field for field in required_fields if field not in data]
                
                if not missing_fields:
                    self.log_result("Weekly Summary", True, f"Retrieved summary: {data['days_worked']} days, {data['total_hours']} hours")
                else:
                    self.log_result("Weekly Summary", False, f"Missing fields: {missing_fields}")
            else:
                self.log_result("Weekly Summary", False, f"Status {response.status_code}: {response.text}")
        except Exception as e:
            self.log_result("Weekly Summary", False, f"Exception: {str(e)}")
    
    def test_delete_entry(self):
        """Test DELETE /api/entries/{date} - Delete an entry"""
        # Create a specific entry for deletion test
        test_date = "2024-01-17"
        entry_data = self.create_test_entry_data(test_date)
        
        try:
            # First create an entry
            create_response = requests.post(
                f"{self.base_url}/entries",
                json=entry_data,
                headers=self.headers
            )
            
            if create_response.status_code == 200:
                # Now delete it
                delete_response = requests.delete(f"{self.base_url}/entries/{test_date}")
                
                if delete_response.status_code == 200:
                    # Verify it's deleted by trying to get it
                    get_response = requests.get(f"{self.base_url}/entries/{test_date}")
                    if get_response.status_code == 404:
                        self.log_result("Delete Entry", True, f"Successfully deleted entry for {test_date}")
                    else:
                        self.log_result("Delete Entry", False, "Entry still exists after deletion")
                else:
                    self.log_result("Delete Entry", False, f"Delete failed: Status {delete_response.status_code}")
            else:
                self.log_result("Delete Entry", False, f"Failed to create entry for deletion test: {create_response.status_code}")
        except Exception as e:
            self.log_result("Delete Entry", False, f"Exception: {str(e)}")
    
    def test_delete_nonexistent_entry(self):
        """Test deleting non-existent entry (should return 404)"""
        nonexistent_date = "2099-12-29"
        
        try:
            response = requests.delete(f"{self.base_url}/entries/{nonexistent_date}")
            
            if response.status_code == 404:
                self.log_result("Delete Non-existent Entry", True, "Correctly returned 404 for non-existent entry")
            else:
                self.log_result("Delete Non-existent Entry", False, f"Should return 404, got {response.status_code}")
        except Exception as e:
            self.log_result("Delete Non-existent Entry", False, f"Exception: {str(e)}")
    
    def cleanup_test_entries(self):
        """Clean up test entries"""
        print("\n🧹 Cleaning up test entries...")
        for date in self.created_entries:
            try:
                requests.delete(f"{self.base_url}/entries/{date}")
                print(f"Cleaned up entry for {date}")
            except:
                pass
    
    def run_all_tests(self):
        """Run all API tests"""
        print(f"🚀 Starting Weekly Timesheet API Tests")
        print(f"🌐 Testing API at: {self.base_url}")
        print("=" * 60)
        
        # Test all endpoints
        self.test_root_endpoint()
        self.test_create_entry()
        self.test_create_duplicate_entry()
        self.test_get_all_entries()
        self.test_get_entry_by_date()
        self.test_get_nonexistent_entry()
        self.test_update_entry()
        self.test_update_nonexistent_entry()
        self.test_weekly_summary()
        self.test_delete_entry()
        self.test_delete_nonexistent_entry()
        
        # Cleanup
        self.cleanup_test_entries()
        
        # Summary
        print("\n" + "=" * 60)
        passed = sum(1 for r in self.test_results if r["success"])
        total = len(self.test_results)
        print(f"📊 Test Results: {passed}/{total} tests passed")
        
        if passed == total:
            print("🎉 All tests passed!")
        else:
            print("❌ Some tests failed. Check details above.")
            failed_tests = [r["test"] for r in self.test_results if not r["success"]]
            print(f"Failed tests: {', '.join(failed_tests)}")
        
        return passed == total


if __name__ == "__main__":
    tester = TimesheetAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)