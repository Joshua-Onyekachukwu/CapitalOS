// =============================================
// Seed CockroachDB with Realistic Data
// =============================================
// Populates: investors, investor_firms, company_profiles, employment history
// Run: node scripts/seed-real-data.js
// =============================================

require("dotenv").config({ path: ".env.local" });
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: true },
  max: 10,
});

// =============================================
// Reference Data
// =============================================

const REAL_FIRMS = [
  { name: "Sequoia Capital", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 1972, investment_stages: ["seed","series_a","series_b","series_c","growth"], investment_sectors: ["saas","ai","consumer","enterprise","fintech"], min_check_size: 1000000, max_check_size: 50000000, fund_size: 8500000000, website: "https://www.sequoiacap.com", domain: "sequoiacap.com", team_size: 120, portfolio_count: 1500, region: "North America" },
  { name: "Andreessen Horowitz", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 2009, investment_stages: ["seed","series_a","series_b","series_c","growth"], investment_sectors: ["ai","fintech","saas","cybersecurity","web3"], min_check_size: 1000000, max_check_size: 100000000, fund_size: 7600000000, website: "https://a16z.com", domain: "a16z.com", team_size: 200, portfolio_count: 900, region: "North America" },
  { name: "Accel", firm_type: "venture_capital", country: "United States", headquarters: "Palo Alto", founded_year: 1983, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["saas","enterprise","fintech","consumer"], min_check_size: 500000, max_check_size: 20000000, fund_size: 6500000000, website: "https://www.accel.com", domain: "accel.com", team_size: 80, portfolio_count: 800, region: "North America" },
  { name: "Benchmark", firm_type: "venture_capital", country: "United States", headquarters: "San Francisco", founded_year: 1995, investment_stages: ["seed","series_a"], investment_sectors: ["saas","consumer","marketplace","enterprise"], min_check_size: 500000, max_check_size: 15000000, fund_size: 425000000, website: "https://www.benchmark.com", domain: "benchmark.com", team_size: 12, portfolio_count: 300, region: "North America" },
  { name: "Lightspeed Venture Partners", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 2000, investment_stages: ["seed","series_a","series_b","growth"], investment_sectors: ["saas","enterprise","consumer","fintech"], min_check_size: 500000, max_check_size: 50000000, fund_size: 10000000000, website: "https://lsvp.com", domain: "lsvp.com", team_size: 100, portfolio_count: 500, region: "North America" },
  { name: "Greylock Partners", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 1965, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["saas","enterprise","ai","consumer"], min_check_size: 500000, max_check_size: 20000000, fund_size: 3500000000, website: "https://greylock.com", domain: "greylock.com", team_size: 40, portfolio_count: 400, region: "North America" },
  { name: "Index Ventures", firm_type: "venture_capital", country: "United States", headquarters: "San Francisco", founded_year: 1996, investment_stages: ["seed","series_a","series_b","growth"], investment_sectors: ["saas","fintech","consumer","healthtech"], min_check_size: 500000, max_check_size: 50000000, fund_size: 5500000000, website: "https://www.indexventures.com", domain: "indexventures.com", team_size: 60, portfolio_count: 600, region: "North America" },
  { name: "Kleiner Perkins", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 1972, investment_stages: ["seed","series_a","series_b","series_c"], investment_sectors: ["saas","consumer","healthtech","energy","ai"], min_check_size: 1000000, max_check_size: 50000000, fund_size: 7000000000, website: "https://www.kleinerperkins.com", domain: "kleinerperkins.com", team_size: 50, portfolio_count: 700, region: "North America" },
  { name: "General Catalyst", firm_type: "venture_capital", country: "United States", headquarters: "Cambridge", founded_year: 2000, investment_stages: ["seed","series_a","series_b","growth"], investment_sectors: ["ai","healthtech","saas","consumer"], min_check_size: 500000, max_check_size: 30000000, fund_size: 6000000000, website: "https://www.generalcatalyst.com", domain: "generalcatalyst.com", team_size: 70, portfolio_count: 500, region: "North America" },
  { name: "Founders Fund", firm_type: "venture_capital", country: "United States", headquarters: "San Francisco", founded_year: 2005, investment_stages: ["seed","series_a","series_b","growth"], investment_sectors: ["ai","deeptech","cybersecurity","saas"], min_check_size: 1000000, max_check_size: 50000000, fund_size: 12000000000, website: "https://foundersfund.com", domain: "foundersfund.com", team_size: 30, portfolio_count: 200, region: "North America" },
  { name: "Y Combinator", firm_type: "accelerator", country: "United States", headquarters: "San Francisco", founded_year: 2005, investment_stages: ["pre_seed","seed"], investment_sectors: ["saas","ai","fintech","consumer","healthtech","deeptech"], min_check_size: 125000, max_check_size: 500000, fund_size: 700000000, website: "https://www.ycombinator.com", domain: "ycombinator.com", team_size: 80, portfolio_count: 4000, region: "North America" },
  { name: "First Round Capital", firm_type: "venture_capital", country: "United States", headquarters: "San Francisco", founded_year: 2004, investment_stages: ["seed"], investment_sectors: ["saas","consumer","enterprise","fintech"], min_check_size: 500000, max_check_size: 4000000, fund_size: 1500000000, website: "https://firstround.com", domain: "firstround.com", team_size: 30, portfolio_count: 500, region: "North America" },
  { name: "Bessemer Venture Partners", firm_type: "venture_capital", country: "United States", headquarters: "San Francisco", founded_year: 1911, investment_stages: ["seed","series_a","series_b","series_c","growth"], investment_sectors: ["saas","enterprise","healthtech","fintech"], min_check_size: 500000, max_check_size: 50000000, fund_size: 5500000000, website: "https://www.bvp.com", domain: "bvp.com", team_size: 60, portfolio_count: 500, region: "North America" },
  { name: "Union Square Ventures", firm_type: "venture_capital", country: "United States", headquarters: "New York", founded_year: 2003, investment_stages: ["seed","series_a"], investment_sectors: ["saas","marketplace","web3","fintech"], min_check_size: 500000, max_check_size: 10000000, fund_size: 1000000000, website: "https://www.usv.com", domain: "usv.com", team_size: 15, portfolio_count: 200, region: "North America" },
  { name: "Battery Ventures", firm_type: "venture_capital", country: "United States", headquarters: "Boston", founded_year: 1983, investment_stages: ["series_a","series_b","series_c","growth"], investment_sectors: ["saas","enterprise","industrial","healthtech"], min_check_size: 1000000, max_check_size: 40000000, fund_size: 8000000000, website: "https://www.battery.com", domain: "battery.com", team_size: 50, portfolio_count: 400, region: "North America" },
  { name: "GV (Google Ventures)", firm_type: "corporate_venture", country: "United States", headquarters: "Mountain View", founded_year: 2009, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["ai","healthtech","consumer","enterprise","robotics"], min_check_size: 500000, max_check_size: 20000000, fund_size: 5000000000, website: "https://www.gv.com", domain: "gv.com", team_size: 60, portfolio_count: 500, region: "North America" },
  { name: "Tiger Global", firm_type: "growth_equity", country: "United States", headquarters: "New York", founded_year: 2001, investment_stages: ["series_b","series_c","growth"], investment_sectors: ["saas","fintech","consumer","enterprise"], min_check_size: 10000000, max_check_size: 250000000, fund_size: 12000000000, website: "https://www.tigerglobal.com", domain: "tigerglobal.com", team_size: 40, portfolio_count: 300, region: "North America" },
  { name: "Coatue Management", firm_type: "growth_equity", country: "United States", headquarters: "New York", founded_year: 1999, investment_stages: ["series_b","series_c","growth"], investment_sectors: ["ai","saas","fintech","consumer"], min_check_size: 5000000, max_check_size: 200000000, fund_size: 15000000000, website: "https://www.coatue.com", domain: "coatue.com", team_size: 50, portfolio_count: 250, region: "North America" },
  { name: "Thrive Capital", firm_type: "growth_equity", country: "United States", headquarters: "New York", founded_year: 2010, investment_stages: ["series_a","series_b","growth"], investment_sectors: ["consumer","saas","healthtech","fintech"], min_check_size: 5000000, max_check_size: 100000000, fund_size: 10000000000, website: "https://www.thrivecap.com", domain: "thrivecap.com", team_size: 30, portfolio_count: 150, region: "North America" },
  { name: "NEA", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 1977, investment_stages: ["seed","series_a","series_b","series_c","growth"], investment_sectors: ["saas","healthtech","enterprise","fintech"], min_check_size: 1000000, max_check_size: 50000000, fund_size: 10000000000, website: "https://www.nea.com", domain: "nea.com", team_size: 80, portfolio_count: 700, region: "North America" },
  { name: "Spark Capital", firm_type: "venture_capital", country: "United States", headquarters: "San Francisco", founded_year: 2007, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["saas","consumer","fintech","ai"], min_check_size: 500000, max_check_size: 20000000, fund_size: 3000000000, website: "https://www.sparkcapital.com", domain: "sparkcapital.com", team_size: 25, portfolio_count: 300, region: "North America" },
  { name: "Felicis Ventures", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 2006, investment_stages: ["seed","series_a"], investment_sectors: ["ai","fintech","consumer","deeptech","robotics"], min_check_size: 500000, max_check_size: 10000000, fund_size: 2000000000, website: "https://www.felicis.com", domain: "felicis.com", team_size: 15, portfolio_count: 300, region: "North America" },
  { name: "Khosla Ventures", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 2004, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["ai","energy","climatetech","healthtech","robotics"], min_check_size: 500000, max_check_size: 20000000, fund_size: 3000000000, website: "https://www.khoslaventures.com", domain: "khoslaventures.com", team_size: 30, portfolio_count: 200, region: "North America" },
  { name: "Insight Partners", firm_type: "growth_equity", country: "United States", headquarters: "New York", founded_year: 1995, investment_stages: ["series_b","series_c","growth"], investment_sectors: ["saas","enterprise","fintech"], min_check_size: 10000000, max_check_size: 100000000, fund_size: 30000000000, website: "https://www.insightpartners.com", domain: "insightpartners.com", team_size: 150, portfolio_count: 600, region: "North America" },
  { name: "Norwest Venture Partners", firm_type: "venture_capital", country: "United States", headquarters: "Palo Alto", founded_year: 1961, investment_stages: ["series_a","series_b","series_c","growth"], investment_sectors: ["saas","enterprise","healthtech","fintech"], min_check_size: 2000000, max_check_size: 30000000, fund_size: 5000000000, website: "https://www.nvp.com", domain: "nvp.com", team_size: 40, portfolio_count: 300, region: "North America" },
  { name: "Menlo Ventures", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 1976, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["saas","ai","enterprise","consumer"], min_check_size: 500000, max_check_size: 20000000, fund_size: 4500000000, website: "https://www.menlovc.com", domain: "menlovc.com", team_size: 30, portfolio_count: 300, region: "North America" },
  { name: "Redpoint Ventures", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 1999, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["saas","cloud","ai","consumer"], min_check_size: 500000, max_check_size: 30000000, fund_size: 4000000000, website: "https://www.redpoint.com", domain: "redpoint.com", team_size: 25, portfolio_count: 200, region: "North America" },
  { name: "Craft Ventures", firm_type: "venture_capital", country: "United States", headquarters: "San Francisco", founded_year: 2017, investment_stages: ["seed","series_a"], investment_sectors: ["saas","marketplace","fintech","crypto"], min_check_size: 500000, max_check_size: 10000000, fund_size: 1000000000, website: "https://www.craftventures.com", domain: "craftventures.com", team_size: 15, portfolio_count: 150, region: "North America" },
  { name: "SignalFire", firm_type: "venture_capital", country: "United States", headquarters: "San Francisco", founded_year: 2013, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["saas","consumer","ai","healthtech"], min_check_size: 500000, max_check_size: 15000000, fund_size: 2000000000, website: "https://www.signalfire.com", domain: "signalfire.com", team_size: 20, portfolio_count: 150, region: "North America" },
  { name: "Initialized Capital", firm_type: "venture_capital", country: "United States", headquarters: "San Francisco", founded_year: 2012, investment_stages: ["seed","series_a"], investment_sectors: ["ai","saas","fintech","consumer"], min_check_size: 250000, max_check_size: 10000000, fund_size: 700000000, website: "https://initialized.com", domain: "initialized.com", team_size: 10, portfolio_count: 200, region: "North America" },
  { name: "Matrix Partners", firm_type: "venture_capital", country: "United States", headquarters: "Palo Alto", founded_year: 1977, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["saas","enterprise","fintech","consumer"], min_check_size: 500000, max_check_size: 20000000, fund_size: 4000000000, website: "https://www.matrixpartners.com", domain: "matrixpartners.com", team_size: 30, portfolio_count: 300, region: "North America" },
  { name: "Sapphire Ventures", firm_type: "growth_equity", country: "United States", headquarters: "Palo Alto", founded_year: 1996, investment_stages: ["series_b","series_c","growth"], investment_sectors: ["saas","enterprise","ai"], min_check_size: 5000000, max_check_size: 50000000, fund_size: 5000000000, website: "https://www.sapphireventures.com", domain: "sapphireventures.com", team_size: 40, portfolio_count: 200, region: "North America" },
  { name: "8VC", firm_type: "venture_capital", country: "United States", headquarters: "Austin", founded_year: 2012, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["ai","cybersecurity","defense","healthtech"], min_check_size: 500000, max_check_size: 15000000, fund_size: 1500000000, website: "https://8vc.com", domain: "8vc.com", team_size: 20, portfolio_count: 100, region: "North America" },
  { name: "Bain Capital Ventures", firm_type: "venture_capital", country: "United States", headquarters: "Boston", founded_year: 1984, investment_stages: ["series_a","series_b","series_c"], investment_sectors: ["saas","enterprise","fintech","healthtech"], min_check_size: 2000000, max_check_size: 30000000, fund_size: 3500000000, website: "https://www.baincapitalventures.com", domain: "baincapitalventures.com", team_size: 40, portfolio_count: 200, region: "North America" },
  { name: "Atomico", firm_type: "venture_capital", country: "United Kingdom", headquarters: "London", founded_year: 2006, investment_stages: ["series_a","series_b","series_c"], investment_sectors: ["saas","fintech","consumer","healthtech"], min_check_size: 1000000, max_check_size: 30000000, fund_size: 2200000000, website: "https://www.atomico.com", domain: "atomico.com", team_size: 40, portfolio_count: 150, region: "Europe" },
  { name: "Balderton Capital", firm_type: "venture_capital", country: "United Kingdom", headquarters: "London", founded_year: 2002, investment_stages: ["series_a","series_b"], investment_sectors: ["saas","marketplace","fintech","consumer"], min_check_size: 1000000, max_check_size: 20000000, fund_size: 1500000000, website: "https://www.balderton.com", domain: "balderton.com", team_size: 30, portfolio_count: 200, region: "Europe" },
  { name: "Northzone", firm_type: "venture_capital", country: "United Kingdom", headquarters: "London", founded_year: 1996, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["saas","fintech","marketplace","consumer"], min_check_size: 500000, max_check_size: 20000000, fund_size: 1000000000, website: "https://northzone.com", domain: "northzone.com", team_size: 25, portfolio_count: 150, region: "Europe" },
  { name: "EQT Ventures", firm_type: "venture_capital", country: "Sweden", headquarters: "Stockholm", founded_year: 2013, investment_stages: ["seed","series_a","series_b","series_c"], investment_sectors: ["saas","ai","consumer","enterprise"], min_check_size: 500000, max_check_size: 30000000, fund_size: 2500000000, website: "https://eqtventures.com", domain: "eqtventures.com", team_size: 35, portfolio_count: 100, region: "Europe" },
  { name: "Lakestar", firm_type: "venture_capital", country: "Germany", headquarters: "Berlin", founded_year: 2012, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["fintech","saas","consumer","healthtech"], min_check_size: 500000, max_check_size: 20000000, fund_size: 1000000000, website: "https://lakestar.com", domain: "lakestar.com", team_size: 20, portfolio_count: 100, region: "Europe" },
  { name: "HV Capital", firm_type: "venture_capital", country: "Germany", headquarters: "Munich", founded_year: 2000, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["saas","fintech","consumer","marketplace"], min_check_size: 500000, max_check_size: 15000000, fund_size: 800000000, website: "https://www.hvcapital.com", domain: "hvcapital.com", team_size: 15, portfolio_count: 80, region: "Europe" },
  { name: "Molten Ventures", firm_type: "venture_capital", country: "United Kingdom", headquarters: "London", founded_year: 2006, investment_stages: ["series_a","series_b","series_c"], investment_sectors: ["saas","fintech","ai","consumer"], min_check_size: 1000000, max_check_size: 20000000, fund_size: 1000000000, website: "https://www.moltenventures.com", domain: "moltenventures.com", team_size: 25, portfolio_count: 120, region: "Europe" },
  { name: "Seedcamp", firm_type: "accelerator", country: "United Kingdom", headquarters: "London", founded_year: 2007, investment_stages: ["pre_seed","seed"], investment_sectors: ["saas","fintech","consumer","ai"], min_check_size: 50000, max_check_size: 500000, fund_size: 200000000, website: "https://seedcamp.com", domain: "seedcamp.com", team_size: 15, portfolio_count: 400, region: "Europe" },
  { name: "Peak XV Partners", firm_type: "venture_capital", country: "India", headquarters: "Bangalore", founded_year: 2006, investment_stages: ["seed","series_a","series_b","series_c"], investment_sectors: ["saas","fintech","consumer","healthtech","ai"], min_check_size: 500000, max_check_size: 30000000, fund_size: 3000000000, website: "https://www.peakxv.com", domain: "peakxv.com", team_size: 40, portfolio_count: 400, region: "Asia" },
  { name: "Vertex Ventures", firm_type: "venture_capital", country: "Israel", headquarters: "Tel Aviv", founded_year: 1988, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["cybersecurity","enterprise","ai","deeptech"], min_check_size: 500000, max_check_size: 20000000, fund_size: 2500000000, website: "https://vertexvc.com", domain: "vertexvc.com", team_size: 25, portfolio_count: 200, region: "Asia" },
  { name: "Jungle Ventures", firm_type: "venture_capital", country: "Singapore", headquarters: "Singapore", founded_year: 2012, investment_stages: ["series_a","series_b"], investment_sectors: ["saas","fintech","consumer","marketplace"], min_check_size: 1000000, max_check_size: 15000000, fund_size: 500000000, website: "https://www.jungle.vc", domain: "jungle.vc", team_size: 15, portfolio_count: 60, region: "Asia" },
  { name: "GGV Capital", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 2000, investment_stages: ["series_a","series_b","series_c"], investment_sectors: ["saas","consumer","ecommerce","enterprise"], min_check_size: 1000000, max_check_size: 50000000, fund_size: 6000000000, website: "https://www.ggvc.com", domain: "ggvc.com", team_size: 30, portfolio_count: 300, region: "North America" },
  { name: "B Capital Group", firm_type: "venture_capital", country: "United States", headquarters: "Menlo Park", founded_year: 2015, investment_stages: ["series_a","series_b","growth"], investment_sectors: ["saas","enterprise","fintech","healthtech"], min_check_size: 2000000, max_check_size: 30000000, fund_size: 6000000000, website: "https://www.bcapgroup.com", domain: "bcapgroup.com", team_size: 30, portfolio_count: 80, region: "North America" },
  { name: "TLcom Capital", firm_type: "venture_capital", country: "United Kingdom", headquarters: "London", founded_year: 1999, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["fintech","saas","consumer","healthtech"], min_check_size: 500000, max_check_size: 15000000, fund_size: 400000000, website: "https://tlcom.com", domain: "tlcom.com", team_size: 10, portfolio_count: 30, region: "Africa" },
  { name: "Partech Africa", firm_type: "venture_capital", country: "France", headquarters: "Paris", founded_year: 2018, investment_stages: ["seed","series_a","series_b"], investment_sectors: ["fintech","saas","consumer","logistics"], min_check_size: 250000, max_check_size: 15000000, fund_size: 300000000, website: "https://partechpartners.com", domain: "partechpartners.com", team_size: 10, portfolio_count: 40, region: "Africa" },
  { name: "General Atlantic", firm_type: "growth_equity", country: "United States", headquarters: "New York", founded_year: 1980, investment_stages: ["series_c","growth"], investment_sectors: ["saas","consumer","fintech","healthtech"], min_check_size: 20000000, max_check_size: 200000000, fund_size: 85000000000, website: "https://www.generalatlantic.com", domain: "generalatlantic.com", team_size: 200, portfolio_count: 400, region: "North America" },
  { name: "KKR", firm_type: "private_equity", country: "United States", headquarters: "New York", founded_year: 1976, investment_stages: ["growth"], investment_sectors: ["saas","enterprise","consumer","healthtech"], min_check_size: 50000000, max_check_size: 500000000, fund_size: 500000000000, website: "https://www.kkr.com", domain: "kkr.com", team_size: 500, portfolio_count: 300, region: "North America" },
  { name: "AngelList Syndicates", firm_type: "angel_syndicate", country: "United States", headquarters: "San Francisco", founded_year: 2010, investment_stages: ["pre_seed","seed"], investment_sectors: ["saas","ai","fintech","consumer","healthtech"], min_check_size: 10000, max_check_size: 250000, fund_size: 100000000, website: "https://www.angellist.com", domain: "angellist.com", team_size: 50, portfolio_count: 5000, region: "North America" },
  { name: "Keiretsu Forum", firm_type: "angel_syndicate", country: "United States", headquarters: "San Francisco", founded_year: 2000, investment_stages: ["pre_seed","seed"], investment_sectors: ["healthtech","saas","consumer","cleantech"], min_check_size: 25000, max_check_size: 500000, fund_size: 50000000, website: "https://www.keiretsuforum.com", domain: "keiretsuforum.com", team_size: 10, portfolio_count: 300, region: "North America" },
];

const FIRST_NAMES_M = ["James","John","Robert","Michael","David","William","Richard","Joseph","Thomas","Charles","Christopher","Daniel","Matthew","Anthony","Mark","Donald","Steven","Paul","Andrew","Joshua","Kenneth","Kevin","Brian","George","Timothy","Ronald","Edward","Jason","Jeffrey","Ryan","Jacob","Gary","Nicholas","Eric","Jonathan","Stephen","Larry","Justin","Scott","Brandon","Benjamin","Samuel","Raymond","Gregory","Frank","Alexander","Patrick","Jack","Dennis","Jerry","Tyler","Aaron","Adam","Nathan","Henry","Zachary","Douglas","Peter","Noah","Ethan","Liam","Mason","Logan","Lucas","Owen","Leo","Aiden","Elijah"];
const FIRST_NAMES_F = ["Mary","Patricia","Jennifer","Linda","Barbara","Elizabeth","Susan","Jessica","Sarah","Karen","Lisa","Nancy","Betty","Margaret","Sandra","Ashley","Dorothy","Kimberly","Emily","Donna","Michelle","Carol","Amanda","Melissa","Deborah","Stephanie","Rebecca","Sharon","Laura","Cynthia","Kathleen","Amy","Angela","Anna","Brenda","Pamela","Emma","Nicole","Helen","Samantha","Katherine","Christine","Rachel","Carolyn","Janet","Catherine","Maria","Heather","Diane","Ruth","Julie","Olivia","Joyce","Virginia","Victoria","Kelly","Lauren","Christina","Joan","Evelyn","Priya","Mei","Fatima","Aisha","Yuki","Sofia","Amara","Zara","Chloe","Nadia","Grace"];
const LAST_NAMES = ["Smith","Johnson","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez","Hernandez","Lopez","Gonzalez","Wilson","Anderson","Thomas","Taylor","Moore","Jackson","Martin","Lee","Perez","Thompson","White","Harris","Sanchez","Clark","Ramirez","Lewis","Robinson","Walker","Young","Allen","King","Wright","Scott","Torres","Nguyen","Hill","Flores","Green","Adams","Nelson","Baker","Hall","Rivera","Campbell","Mitchell","Carter","Roberts","Gomez","Phillips","Evans","Turner","Diaz","Parker","Cruz","Edwards","Collins","Reyes","Stewart","Morris","Morales","Murphy","Cook","Rogers","Gutierrez","Ortiz","Morgan","Cooper","Peterson","Bailey","Reed","Kelly","Howard","Ramos","Kim","Cox","Ward","Richardson","Watson","Brooks","Chavez","Wood","Bennett","Gray","Mendoza","Ruiz","Hughes","Price","Alvarez","Castillo","Sanders","Patel","Myers","Long","Ross","Foster","Jimenez","Powell","Jenkins","Perry","Russell","Chen","Wang","Li","Zhang","Liu","Yang","Wu","Zhou","Sharma","Gupta","Singh","Kumar","Muller","Schmidt","Schneider","Fischer","Weber","Tanaka","Sato","Watanabe","Ito","Yamamoto","Nakamura","Kobayashi","Suzuki","Kimura","Okafor","Adeyemi"];
const JOB_TITLES = ["General Partner","Managing Partner","Partner","Principal","Venture Partner","Senior Associate","Associate","Investment Director","Head of Investments","Managing Director","Investment Manager","Founding Partner","Co-Founder","CEO","Chief Investment Officer","Director of Investments","Senior Partner","Investment Analyst","Angel Investor","Advisor","Board Member","Operating Partner"];
const BIOS = [
  "Experienced venture capitalist with focus on early-stage technology investments.",
  "Serial entrepreneur turned investor. Passionate about founders building the future.",
  "Long-time investor in enterprise software and cloud infrastructure.",
  "Focused on climate tech and sustainability investments across growth stages.",
  "Deep expertise in fintech and digital banking investments globally.",
  "Backing founders building AI-first products and infrastructure.",
  "Investing in the future of work and enterprise productivity tools.",
  "Portfolio spans 50+ companies across consumer and enterprise.",
  "Active angel investor and mentor to early-stage founders.",
  "Led investments in 20+ successful exits over the past decade.",
  "Specializing in healthtech and digital health transformation.",
  "Technology investor with a focus on cybersecurity and data privacy.",
  "Supporting underrepresented founders building transformative companies.",
  "Building the next generation of developer tools and infrastructure.",
  "Experienced investor in mobility, logistics, and supply chain.",
  "Passionate about edtech and the future of learning.",
  "Global investor with experience across US, Europe, and Asia.",
  "Former operator who now helps founders scale from seed to growth.",
  "Dedicated to impact investing and social enterprise.",
  "Expert in B2B SaaS and recurring revenue business models.",
];
const CITIES = [
  { city: "San Francisco", country: "United States" },
  { city: "New York", country: "United States" },
  { city: "Los Angeles", country: "United States" },
  { city: "Boston", country: "United States" },
  { city: "Austin", country: "United States" },
  { city: "Seattle", country: "United States" },
  { city: "Chicago", country: "United States" },
  { city: "Miami", country: "United States" },
  { city: "Denver", country: "United States" },
  { city: "London", country: "United Kingdom" },
  { city: "Berlin", country: "Germany" },
  { city: "Paris", country: "France" },
  { city: "Amsterdam", country: "Netherlands" },
  { city: "Stockholm", country: "Sweden" },
  { city: "Singapore", country: "Singapore" },
  { city: "Tokyo", country: "Japan" },
  { city: "Bangalore", country: "India" },
  { city: "Tel Aviv", country: "Israel" },
  { city: "São Paulo", country: "Brazil" },
  { city: "Sydney", country: "Australia" },
];

const SECTORS = ["ai","fintech","saas","healthtech","climatetech","consumer","cybersecurity","edtech","deeptech","robotics","web3","enterprise","mobility","proptech","agritech","energy","media","logistics","devtools","marketplace"];
const STAGES = ["pre_seed","seed","series_a","series_b","series_c","growth"];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function subset(arr, min, max) {
  const count = min + Math.floor(Math.random() * (max - min + 1));
  return [...arr].sort(() => Math.random() - 0.5).slice(0, count);
}
function randInt(min, max) { return min + Math.floor(Math.random() * (max - min + 1)); }
function genEmail(first, last) {
  const sep = pick([".", "_", ""]);
  const num = Math.random() > 0.6 ? randInt(1, 99) : "";
  return `${first.toLowerCase()}${sep}${last.toLowerCase()}${num}@${pick(["gmail.com","yahoo.com","outlook.com"])}`;
}

// =============================================
// Main
// =============================================
async function main() {
  const client = await pool.connect();
  const startTime = Date.now();

  try {
    console.log("🚀 Seeding CockroachDB with real data...\n");

    // ====== STEP 1: Insert Firms ======
    console.log("📦 Step 1: Inserting investor firms...");
    const firmIds = [];

    for (let i = 0; i < REAL_FIRMS.length; i++) {
      const f = REAL_FIRMS[i];
      const result = await client.query(
        `INSERT INTO investor_firms (name, domain, website, firm_type, headquarters, country, region, investment_stages, investment_sectors, investment_geographies, min_check_size, max_check_size, fund_size, founded_year, team_size, portfolio_count, source, source_id, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING id`,
        [f.name, f.domain, f.website, f.firm_type, f.headquarters, f.country, f.region || "North America",
         f.investment_stages, f.investment_sectors, [f.country],
         f.min_check_size, f.max_check_size, f.fund_size, f.founded_year,
         f.team_size, f.portfolio_count, "seed", `firm_${i}`, new Date().toISOString()]
      );
      firmIds.push(result.rows[0].id);
    }
    console.log(`   ✅ Inserted ${firmIds.length} firms\n`);

    // ====== STEP 2: Insert Investors ======
    console.log("📦 Step 2: Inserting 5,000 investors...");
    const INVESTOR_COUNT = 5000;
    const BATCH = 200;
    let totalInserted = 0;

    for (let i = 0; i < INVESTOR_COUNT; i += BATCH) {
      const batchSize = Math.min(BATCH, INVESTOR_COUNT - i);

      // Build rows as objects for clarity
      const rows = [];
      for (let j = 0; j < batchSize; j++) {
        const first = pick([...FIRST_NAMES_M, ...FIRST_NAMES_F]);
        const last = pick(LAST_NAMES);
        const investorType = pick(["venture_capital","venture_capital","venture_capital","angel_investor","angel_investor","accelerator","micro_vc","corporate_venture","family_office","private_equity","impact_investor"]);
        const loc = pick(CITIES);
        const stages = subset(STAGES, 1, 3);
        const sectors = subset(SECTORS, 1, 5);
        const hasFirm = firmIds.length > 0 && Math.random() > 0.4;
        const firmId = hasFirm ? pick(firmIds) : null;
        const checkMin = investorType === "angel_investor" ? randInt(5000, 50000) : investorType === "accelerator" ? 25000 : randInt(100000, 500000);
        const checkMax = investorType === "angel_investor" ? randInt(25000, 250000) : investorType === "accelerator" ? 150000 : randInt(2000000, 50000000);
        const hasEmail = Math.random() > 0.35;
        const hasLinkedIn = Math.random() > 0.3;

        rows.push({
          full_name: `${first} ${last}`,
          first_name: first,
          last_name: last,
          email: hasEmail ? genEmail(first, last) : null,
          linkedin_url: hasLinkedIn ? `https://linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-${randInt(100,9999)}` : null,
          job_title: pick(JOB_TITLES),
          investor_type: investorType,
          investment_stages: stages,
          investment_sectors: sectors,
          investment_geographies: [loc.country],
          country: loc.country,
          city: loc.city,
          min_check_size: checkMin,
          max_check_size: checkMax,
          currency: "USD",
          portfolio_count: randInt(0, 80),
          bio: pick(BIOS),
          is_active: true,
          is_verified: Math.random() > 0.4,
          outreach_readiness: "not_ready",
          current_firm_id: firmId,
          source: "generated",
          source_id: `inv_${i + j}`,
          created_at: new Date().toISOString(),
        });
      }

      const COLS = "full_name,first_name,last_name,email,linkedin_url,job_title,investor_type,investment_stages,investment_sectors,investment_geographies,country,city,min_check_size,max_check_size,currency,portfolio_count,bio,is_active,is_verified,outreach_readiness,current_firm_id,source,source_id,created_at";
      const NUM_COLS = 24;
      const values = [];
      const params = [];
      let idx = 1;

      for (const row of rows) {
        const placeholders = [];
        for (let c = 0; c < NUM_COLS; c++) placeholders.push(`$${idx++}`);
        values.push(`(${placeholders.join(",")})`);
        params.push(
          row.full_name, row.first_name, row.last_name, row.email, row.linkedin_url,
          row.job_title, row.investor_type, row.investment_stages, row.investment_sectors,
          row.investment_geographies, row.country, row.city, row.min_check_size, row.max_check_size,
          row.currency, row.portfolio_count, row.bio, row.is_active, row.is_verified,
          row.outreach_readiness, row.current_firm_id, row.source, row.source_id, row.created_at
        );
      }

      try {
        const result = await client.query(
          `INSERT INTO investors (${COLS}) VALUES ${values.join(",")} RETURNING id`,
          params
        );
        totalInserted += result.rowCount;

        // Employment history for investors with firms
        const empParts = [];
        const empParams2 = [];
        let ep = 1;
        for (let j = 0; j < rows.length; j++) {
          if (rows[j].current_firm_id && result.rows[j]) {
            empParts.push(`($${ep++},$${ep++},$${ep++},$${ep++},$${ep++},$${ep++})`);
            empParams2.push(result.rows[j].id, rows[j].current_firm_id, null, rows[j].job_title, `${randInt(2010,2024)}-${String(randInt(1,12)).padStart(2,"0")}-01`, true);
          }
        }
        if (empParts.length > 0) {
          try {
            await client.query(`INSERT INTO investor_employment_history (investor_id,firm_id,firm_name,title,start_date,is_current) VALUES ${empParts.join(",")}`, empParams2);
          } catch { /* non-critical */ }
        }
      } catch (err) {
        console.error(`   ⚠️  Batch error: ${err.message.substring(0, 100)}`);
      }

      if ((i + BATCH) % 1000 === 0 || i + BATCH >= INVESTOR_COUNT) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`   📥 ${totalInserted.toLocaleString()} / ${INVESTOR_COUNT.toLocaleString()} investors (${((totalInserted/INVESTOR_COUNT)*100).toFixed(0)}%) — ${elapsed}s`);
      }
    }
    console.log(`   ✅ Inserted ${totalInserted.toLocaleString()} investors\n`);

    // ====== STEP 3: Insert Company Profiles ======
    console.log("📦 Step 3: Inserting company profiles...");
    const COMPANIES = [
      ["Stripe", "stripe.com", "fintech", "Financial infrastructure for the internet. Millions of businesses use Stripe to accept payments.", "https://stripe.com"],
      ["OpenAI", "openai.com", "ai", "AI research and deployment company. Creator of GPT, DALL-E, and ChatGPT.", "https://openai.com"],
      ["Databricks", "databricks.com", "saas", "Unified analytics platform for data and AI. Creator of Apache Spark.", "https://databricks.com"],
      ["Figma", "figma.com", "saas", "Collaborative interface design tool. Used by millions of designers worldwide.", "https://figma.com"],
      ["Canva", "canva.com", "consumer", "Online design and publishing platform. Empowers the world to design.", "https://canva.com"],
      ["Notion", "notion.so", "saas", "Connected workspace for wiki, docs, and projects.", "https://notion.so"],
      ["Ramp", "ramp.com", "fintech", "Corporate card and spend management platform.", "https://ramp.com"],
      ["Brex", "brex.com", "fintech", "Financial stack for startups. Corporate card, business account, and travel.", "https://brex.com"],
      ["Vercel", "vercel.com", "devtools", "Platform for frontend developers. Develop. Preview. Ship.", "https://vercel.com"],
      ["Linear", "linear.app", "saas", "Streamline issues, sprints, and product roadmaps.", "https://linear.app"],
      ["Supabase", "supabase.com", "saas", "Open source Firebase alternative. Build in a fast, open, and scalable way.", "https://supabase.com"],
      ["Retool", "retool.com", "saas", "Build internal tools remarkably fast. Drag-and-drop UI components.", "https://retool.com"],
      ["Miro", "miro.com", "saas", "Online collaborative whiteboard platform for distributed teams.", "https://miro.com"],
      ["Revolut", "revolut.com", "fintech", "One app, all things money. Global financial super app.", "https://revolut.com"],
      ["Wise", "wise.com", "fintech", "International money transfers. Honest, transparent, fast.", "https://wise.com"],
      ["N26", "n26.com", "fintech", "Banking, redesigned for you. Mobile-first banking experience.", "https://n26.com"],
      ["Klarna", "klarna.com", "fintech", "Smooth payments. Buy now, pay later. Europe's largest fintech.", "https://klarna.com"],
      ["Plaid", "plaid.com", "fintech", "The API for fintech. Connecting apps to users' bank accounts.", "https://plaid.com"],
      ["PostHog", "posthog.com", "saas", "Open source product analytics. All your data, all in one place.", "https://posthog.com"],
      ["Cal.com", "cal.com", "saas", "Open source scheduling infrastructure for everyone.", "https://cal.com"],
      ["Resend", "resend.com", "saas", "Email for developers. The modern email API.", "https://resend.com"],
      ["Railway", "railway.app", "saas", "Deploy apps instantly. Infrastructure for developers.", "https://railway.app"],
      ["Planetscale", "planetscale.com", "saas", "The MySQL-compatible serverless database platform.", "https://planetscale.com"],
      ["Neon", "neon.tech", "saas", "Serverless Postgres. Separate storage and compute.", "https://neon.tech"],
      ["Sentry", "sentry.io", "saas", "Error tracking and performance monitoring for developers.", "https://sentry.io"],
      ["Algolia", "algolia.com", "saas", "Search and discovery API. Build real-time search experiences.", "https://algolia.com"],
      ["Contentful", "contentful.com", "saas", "Composable content platform for digital experiences.", "https://contentful.com"],
      ["Datadog", "datadoghq.com", "saas", "Monitoring and analytics platform for developers, IT, and business teams.", "https://datadoghq.com"],
      ["Grafana Labs", "grafana.com", "saas", "Open source observability. The composable analytics platform.", "https://grafana.com"],
      ["Cloudflare", "cloudflare.com", "saas", "Internet security and performance platform.", "https://cloudflare.com"],
      ["GitLab", "gitlab.com", "devtools", "DevSecOps platform. The complete CI/CD solution.", "https://gitlab.com"],
      ["Anthropic", "anthropic.com", "ai", "AI safety company. Building reliable, interpretable, and steerable AI systems.", "https://anthropic.com"],
      ["Mistral AI", "mistral.ai", "ai", "Open and portable generative AI for devs and businesses.", "https://mistral.ai"],
      ["Perplexity", "perplexity.ai", "ai", "AI-powered answer engine. Ask anything, get cited answers.", "https://perplexity.ai"],
      ["Runway", "runwayml.com", "ai", "AI for creative tools. Generative video and content creation.", "https://runwayml.com"],
      ["Hugging Face", "huggingface.co", "ai", "The AI community. Open source models, datasets, and tools.", "https://huggingface.co"],
      ["Cohere", "cohere.com", "ai", "Enterprise AI platform. NLP models for businesses.", "https://cohere.com"],
      ["Scale AI", "scale.com", "ai", "Data platform for AI. Fueling the AI revolution with data.", "https://scale.com"],
      ["Celonis", "celonis.com", "saas", "Process mining and execution management platform.", "https://celonis.com"],
      ["Wiz", "wiz.io", "cybersecurity", "Cloud security platform. Protect everything in the cloud.", "https://wiz.io"],
      ["Datadog Inc", "datadoghq.com", "saas", "Cloud monitoring and security for modern applications.", "https://datadoghq.com"],
    ];

    let companiesInserted = 0;
    for (const [name, domain, industry, desc, url] of COMPANIES) {
      try {
        await client.query(
          `INSERT INTO company_profiles (company_name, website_url, industry, description, onboarding_completed, created_at) VALUES ($1,$2,$3,$4,$5,$6)`,
          [name, url, industry, desc, true, new Date().toISOString()]
        );
        companiesInserted++;
      } catch (e) {
        console.log(`   ⚠️  Skipped ${name}: ${e.message.substring(0, 80)}`);
      }
    }
    console.log(`   ✅ Inserted ${companiesInserted} company profiles\n`);

    // ====== STEP 4: Run Scoring ======
    console.log("📦 Step 4: Running bulk scoring...");
    try {
      await client.query(`
        UPDATE investors SET
          data_quality_score = LEAST(100, (
            (CASE WHEN email IS NOT NULL THEN 12 ELSE 0 END) +
            (CASE WHEN linkedin_url IS NOT NULL THEN 12 ELSE 0 END) +
            (CASE WHEN job_title IS NOT NULL THEN 12 ELSE 0 END) +
            (CASE WHEN investment_stages IS NOT NULL AND array_length(investment_stages, 1) > 0 THEN 12 ELSE 0 END) +
            (CASE WHEN investment_sectors IS NOT NULL AND array_length(investment_sectors, 1) > 0 THEN 12 ELSE 0 END) +
            (CASE WHEN bio IS NOT NULL AND length(bio) > 0 THEN 13 ELSE 0 END) +
            (CASE WHEN country IS NOT NULL THEN 13 ELSE 0 END) +
            (CASE WHEN city IS NOT NULL THEN 13 ELSE 0 END)
          )),
          outreach_readiness = CASE
            WHEN do_not_contact = true THEN 'do_not_contact'::outreach_readiness
            WHEN (
              (CASE WHEN email IS NOT NULL THEN 30 ELSE 0 END) +
              (CASE WHEN linkedin_url IS NOT NULL THEN 20 ELSE 0 END) +
              (CASE WHEN is_verified = true THEN 15 ELSE 0 END) +
              (CASE WHEN bio IS NOT NULL AND length(bio) > 50 THEN 10 ELSE 0 END)
            ) >= 70 THEN 'ready'::outreach_readiness
            WHEN (
              (CASE WHEN email IS NOT NULL THEN 30 ELSE 0 END) +
              (CASE WHEN linkedin_url IS NOT NULL THEN 20 ELSE 0 END) +
              (CASE WHEN is_verified = true THEN 15 ELSE 0 END) +
              (CASE WHEN bio IS NOT NULL AND length(bio) > 50 THEN 10 ELSE 0 END)
            ) >= 40 THEN 'needs_verification'::outreach_readiness
            ELSE 'not_ready'::outreach_readiness
          END
      `);
      console.log("   ✅ Scoring complete\n");
    } catch (e) {
      console.log(`   ⚠️  Scoring: ${e.message.substring(0, 80)}\n`);
    }

    // ====== Summary ======
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log("========================================");
    console.log("  SEED COMPLETE");
    console.log("========================================");
    for (const t of ["investors", "investor_firms", "company_profiles", "investor_employment_history"]) {
      const r = await client.query(`SELECT count(*) as count FROM ${t}`);
      console.log(`  ${t}: ${parseInt(r.rows[0].count).toLocaleString()} rows`);
    }

    try {
      const readiness = await client.query(`SELECT outreach_readiness, count(*) as count FROM investors GROUP BY outreach_readiness`);
      console.log("\n  Investor readiness:");
      for (const row of readiness.rows) {
        console.log(`    ${row.outreach_readiness}: ${parseInt(row.count).toLocaleString()}`);
      }
    } catch { /* ok */ }

    console.log(`\n  Total time: ${elapsed}s`);
    console.log("  🎉 Ready to use!\n");

  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
