/**
 * SEED DATA: Fail-safe embedded records.
 * Ensures the dashboard is fully populated even if Firestore or Disk fail.
 */

const SEED_ACCOUNTS = [
  {
    "id": "hotel-tp001",
    "name": "Azure Bay Resort",
    "industry": "Resort & Spa",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 18000,
    "contractEnd": "2027-01-15",
    "status": "Healthy",
    "healthScore": 92,
    "totalRooms": 300,
    "occupancyPct": 88,
    "adr": 520,
    "revPar": 457,
    "directBookingPct": 45,
    "reviewScore": 4.9,
    "openTickets": 0,
    "paymentStatus": "good"
  },
  {
    "id": "hotel-tp002",
    "name": "Mountain View Lodge",
    "industry": "Lodge",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 8500,
    "contractEnd": "2026-11-30",
    "status": "At Risk",
    "healthScore": 45,
    "totalRooms": 120,
    "occupancyPct": 55,
    "adr": 210,
    "revPar": 115,
    "directBookingPct": 18,
    "reviewScore": 3.8,
    "openTickets": 3,
    "paymentStatus": "good"
  },
  {
    "id": "hotel-tp003",
    "name": "Urban Suites London",
    "industry": "Corporate Hotel",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 12000,
    "contractEnd": "2026-08-15",
    "status": "Healthy",
    "healthScore": 78,
    "totalRooms": 200,
    "occupancyPct": 72,
    "adr": 340,
    "revPar": 244,
    "directBookingPct": 32,
    "reviewScore": 4.5,
    "openTickets": 1,
    "paymentStatus": "good"
  },
  {
    "id": "hotel-tp004",
    "name": "Seaside Budget Inn",
    "industry": "Economy",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 3200,
    "contractEnd": "2026-06-01",
    "status": "Critical",
    "healthScore": 25,
    "totalRooms": 50,
    "occupancyPct": 30,
    "adr": 95,
    "revPar": 28,
    "directBookingPct": 8,
    "reviewScore": 2.9,
    "openTickets": 9,
    "paymentStatus": "late"
  },
  {
    "id": "hotel-tp005",
    "name": "Parkside Heritage",
    "industry": "Luxury Boutique",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 7500,
    "contractEnd": "2026-12-25",
    "status": "Healthy",
    "healthScore": 84,
    "totalRooms": 65,
    "occupancyPct": 78,
    "adr": 310,
    "revPar": 241,
    "directBookingPct": 38,
    "reviewScore": 4.7,
    "openTickets": 1,
    "paymentStatus": "good"
  },
  {
    "id": "hotel-tp006",
    "name": "Elite Urban Tower",
    "industry": "Luxury Resort",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 25000,
    "contractEnd": "2027-06-15",
    "status": "Healthy",
    "healthScore": 95,
    "totalRooms": 400,
    "occupancyPct": 92,
    "adr": 650,
    "revPar": 598,
    "directBookingPct": 48,
    "reviewScore": 4.9,
    "openTickets": 0,
    "paymentStatus": "good"
  },
  {
    "id": "hotel-tp007",
    "name": "Coastal Breeze Suites",
    "industry": "Boutique Hotel",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 9500,
    "contractEnd": "2026-10-10",
    "status": "At Risk",
    "healthScore": 58,
    "totalRooms": 150,
    "occupancyPct": 65,
    "adr": 280,
    "revPar": 182,
    "directBookingPct": 22,
    "reviewScore": 4.1,
    "openTickets": 4,
    "paymentStatus": "good"
  },
  {
    "id": "hotel-tp008",
    "name": "Metro Budget Stays",
    "industry": "Economy",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 4200,
    "contractEnd": "2026-05-30",
    "status": "Critical",
    "healthScore": 28,
    "totalRooms": 100,
    "occupancyPct": 42,
    "adr": 110,
    "revPar": 46,
    "directBookingPct": 10,
    "reviewScore": 3.1,
    "openTickets": 12,
    "paymentStatus": "late"
  },
  {
    "id": "hotel-tp009",
    "name": "Summit Alpine Resort",
    "industry": "Resort & Spa",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 32000,
    "contractEnd": "2027-12-01",
    "status": "Healthy",
    "healthScore": 89,
    "totalRooms": 500,
    "occupancyPct": 85,
    "adr": 420,
    "revPar": 357,
    "directBookingPct": 38,
    "reviewScore": 4.7,
    "openTickets": 2,
    "paymentStatus": "good"
  },
  {
    "id": "hotel-tp010",
    "name": "Silicon Valley Loft",
    "industry": "Corporate Hotel",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 15000,
    "contractEnd": "2027-03-20",
    "status": "Healthy",
    "healthScore": 82,
    "totalRooms": 220,
    "occupancyPct": 78,
    "adr": 380,
    "revPar": 296,
    "directBookingPct": 35,
    "reviewScore": 4.6,
    "openTickets": 1,
    "paymentStatus": "good"
  },
  {
    "id": "hotel-tp011",
    "name": "Rustic Creek Cabins",
    "industry": "Lodge",
    "partnerTag": "testpilot",
    "csm": "Alex Taylor",
    "contractValue": 6800,
    "contractEnd": "2026-11-15",
    "status": "At Risk",
    "healthScore": 52,
    "totalRooms": 40,
    "occupancyPct": 60,
    "adr": 190,
    "revPar": 114,
    "directBookingPct": 15,
    "reviewScore": 4.0,
    "openTickets": 3,
    "paymentStatus": "good"
  }
];

const SEED_USERS = [
  {
    "id": "u-admin",
    "email": "admin@csm.local",
    "role": "admin",
    "name": "Super Admin",
    "partnerTag": "csm-global"
  },
  {
    "id": "u-testpilot",
    "email": "consultant@testpilot.com",
    "role": "client",
    "name": "Test Pilot",
    "partnerTag": "testpilot"
  }
];

const SEED_TICKETS = [
  { "id": "t1", "accountId": "hotel-tp008", "accountName": "Metro Budget Stays", "title": "PMS Integration Failure", "priority": "Critical", "status": "Escalated", "category": "Technical", "assignee": "Sarah Chen", "createdAt": new Date(Date.now() - 518400000).toISOString() },
  { "id": "t2", "accountId": "hotel-tp004", "accountName": "Seaside Budget Inn", "title": "Bulk Guest Data Error", "priority": "High", "status": "In Progress", "category": "Data", "assignee": "Alex Taylor", "createdAt": new Date(Date.now() - 345600000).toISOString() },
  { "id": "t3", "accountId": "hotel-tp011", "accountName": "Rustic Creek Cabins", "title": "Billing Clarification", "priority": "Medium", "status": "Open", "category": "Billing", "assignee": "Alex Taylor", "createdAt": new Date(Date.now() - 172800000).toISOString() }
];

const SEED_ALERTS = [
  {
    "id": "a1",
    "accountId": "hotel-tp011",
    "accountName": "Rustic Creek Cabins",
    "title": "Local competitor launched aggressive direct booking campaign",
    "level": "high",
    "levelLabel": "Competitive Risk",
    "source": "Market Watch",
    "pubDate": new Date().toISOString()
  },
  {
    "id": "a2",
    "accountId": "hotel-tp008",
    "accountName": "Metro Budget Stays",
    "title": "Review sentiment dropping: 2.1 stars this week",
    "level": "critical",
    "levelLabel": "Service Failure",
    "source": "Reputation Intelligence",
    "pubDate": new Date().toISOString()
  }
];

module.exports = { SEED_ACCOUNTS, SEED_USERS, SEED_TICKETS, SEED_ALERTS };
