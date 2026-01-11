// scripts/verifyUserData.js
// Script to verify what data exists for users

const mongoose = require("mongoose");
const User = require("../models/User");
const Admin = require("../models/Register");
const path = require("path");

require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function verifyUserData() {
  try {
    const dbUri =
      process.env.MONGO_URL || process.env.MONGO_URL || process.env.DB_URI;

    await mongoose.connect(dbUri);
    console.log("✅ Connected to database\n");

    // Get all admins
    const admins = await Admin.find();
    console.log(`👥 Total Admins: ${admins.length}\n`);

    admins.forEach((admin, index) => {
      console.log(`Admin ${index + 1}:`);
      console.log(`   Name: ${admin.FullName}`);
      console.log(`   Email: ${admin.email}`);
      console.log(`   Company: ${admin.CompanyName}`);
      console.log(`   ID: ${admin._id}\n`);
    });

    // Get all users with populated createdBy
    const users = await User.find()
      .populate("createdBy", "FullName email CompanyName")
      .lean();

    console.log(`👤 Total Users: ${users.length}\n`);

    users.forEach((user, index) => {
      console.log(`User ${index + 1}:`);
      console.log(`   Username: ${user.userName}`);
      console.log(`   Role: ${user.user}`);
      console.log(`   User Type: ${user.userType}`);
      console.log(`   Mobile: ${user.MobileNumber}`);
      console.log(`   Color: ${user.color}`);
      console.log(`   ID: ${user._id}`);

      if (user.createdBy) {
        if (typeof user.createdBy === "object") {
          console.log(
            `   ✓ Created By: ${user.createdBy.FullName} (${user.createdBy.email})`
          );
          console.log(`   ✓ Admin ID: ${user.createdBy._id}`);
        } else {
          console.log(`   ⚠ Created By ID: ${user.createdBy} (not populated)`);
        }
      } else {
        console.log(`   ✗ Created By: NULL or MISSING`);
      }
      console.log("");
    });

    // Test the exact login query
    console.log('\n🔍 Testing Login Query for "Deva":\n');
    const testUser = await User.findOne({ userName: "Deva" })
      .populate("createdBy", "FullName email CompanyName color")
      .lean();

    if (testUser) {
      console.log("Login query result:");
      console.log(JSON.stringify(testUser, null, 2));

      console.log("\n📦 What should be sent to frontend:");
      console.log({
        _id: testUser._id,
        userName: testUser.userName,
        role: testUser.user,
        userType: testUser.userType,
        color: testUser.color,
        createdBy: testUser.createdBy?._id || testUser.createdBy,
        mobile: testUser.MobileNumber,
      });
    } else {
      console.log('❌ User "Deva" not found');
    }

    await mongoose.connection.close();
    console.log("\n✅ Verification complete");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    try {
      await mongoose.connection.close();
    } catch (e) {}
    process.exit(1);
  }
}

console.log("🔍 Starting user data verification...\n");
verifyUserData();

// To run: node scripts/verifyUserData.js
