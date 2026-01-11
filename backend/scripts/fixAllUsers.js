// scripts/fixAllUsers.js
// Comprehensive script to fix ALL user issues

const mongoose = require("mongoose");
const User = require("../models/User");
const Admin = require("../models/Register");
require("dotenv").config();

async function fixAllUsers() {
  try {
    // Connect to database
    await mongoose.connect(process.env.MONGO_URL, {});

    console.log("✅ Connected to database\n");

    // Find ALL users (including those with null createdBy)
    const allUsers = await User.find({ userType: "user" });

    console.log(`📋 Total users in database: ${allUsers.length}\n`);

    // Separate users into categories
    const usersWithNullCreatedBy = allUsers.filter(
      (u) => u.createdBy === null || u.createdBy === undefined
    );
    const usersWithInvalidCreatedBy = [];
    const usersWithValidCreatedBy = [];

    // Check validity of createdBy references
    for (const user of allUsers) {
      if (user.createdBy === null || user.createdBy === undefined) {
        continue; // Already counted above
      }

      // Check if the admin exists
      const adminExists = await Admin.findById(user.createdBy);
      if (!adminExists) {
        usersWithInvalidCreatedBy.push(user);
      } else {
        usersWithValidCreatedBy.push(user);
      }
    }

    console.log("📊 User Status Summary:");
    console.log(`   ✓ Valid createdBy: ${usersWithValidCreatedBy.length}`);
    console.log(`   ✗ Null createdBy: ${usersWithNullCreatedBy.length}`);
    console.log(
      `   ⚠ Invalid createdBy reference: ${usersWithInvalidCreatedBy.length}\n`
    );

    const usersToFix = [
      ...usersWithNullCreatedBy,
      ...usersWithInvalidCreatedBy,
    ];

    if (usersToFix.length === 0) {
      console.log("✅ All users are properly linked to admins!");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Find available admin
    const admin = await Admin.findOne();

    if (!admin) {
      console.error("❌ No admin found in database!");
      console.log(
        "   Please create an admin first using your admin registration endpoint.\n"
      );
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`👤 Found admin: ${admin.FullName}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Company: ${admin.CompanyName}`);
    console.log(`   Admin ID: ${admin._id}\n`);

    console.log("🔧 Users to be fixed:\n");
    usersToFix.forEach((user, index) => {
      const status = user.createdBy === null ? "(null)" : "(invalid ref)";
      console.log(`   ${index + 1}. ${user.userName} - ${user.user} ${status}`);
      console.log(`      ID: ${user._id}`);
      console.log(`      Mobile: ${user.MobileNumber}`);
      console.log(`      Color: ${user.color}`);
      console.log(`      Current createdBy: ${user.createdBy || "null"}\n`);
    });

    // Update all problematic users
    const userIdsToFix = usersToFix.map((u) => u._id);

    const result = await User.updateMany(
      { _id: { $in: userIdsToFix } },
      { $set: { createdBy: admin._id } }
    );

    console.log(`✅ Updated ${result.modifiedCount} users\n`);

    // Verify the changes
    console.log("🔍 Verification:\n");
    const verifiedUsers = await User.find({
      _id: { $in: userIdsToFix },
    }).populate("createdBy", "FullName email CompanyName");

    let successCount = 0;
    let failCount = 0;

    for (const user of verifiedUsers) {
      if (user.createdBy && user.createdBy._id) {
        console.log(`   ✓ ${user.userName}`);
        console.log(
          `     → Linked to: ${user.createdBy.FullName} (${user.createdBy.email})`
        );
        console.log(`     → Admin ID: ${user.createdBy._id}\n`);
        successCount++;
      } else {
        console.log(`   ✗ ${user.userName} - FAILED TO UPDATE\n`);
        failCount++;
      }
    }

    console.log("\n📈 Results:");
    console.log(`   ✓ Successfully fixed: ${successCount}`);
    if (failCount > 0) {
      console.log(`   ✗ Failed: ${failCount}`);
    }

    // Show final statistics
    const finalCheck = await User.find({ userType: "user" }).populate(
      "createdBy"
    );
    const stillBroken = finalCheck.filter(
      (u) => !u.createdBy || u.createdBy === null
    );

    if (stillBroken.length === 0) {
      console.log("\n🎉 SUCCESS! All users are now properly linked to admins!");
    } else {
      console.log(`\n⚠ WARNING: ${stillBroken.length} users still have issues`);
      console.log(
        "   You may need to run this script again or fix them manually."
      );
    }

    await mongoose.connection.close();
    console.log("\n✅ Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error("Stack:", error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
console.log("🚀 Starting comprehensive user fix script...\n");
fixAllUsers();

// To run: node scripts/fixAllUsers.js
