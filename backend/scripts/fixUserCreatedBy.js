// scripts/fixUserCreatedBy.js
// Run this script once to fix users without createdBy field

const mongoose = require("mongoose");
const User = require("../models/User");
const Admin = require("../models/Register");
require("dotenv").config();

async function fixUsersCreatedBy() {
  try {
    // Connect to database
    await mongoose.connect(
      process.env.MONGO_URL || "mongodb://localhost:27017/your_db_name",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    console.log("✅ Connected to database");

    // Find all users without createdBy
    const usersWithoutCreatedBy = await User.find({
      $or: [{ createdBy: null }, { createdBy: { $exists: false } }],
      userType: "user", // Only fix regular users
    });

    console.log(
      `\n📋 Found ${usersWithoutCreatedBy.length} users without createdBy field`
    );

    if (usersWithoutCreatedBy.length === 0) {
      console.log("✅ No users need to be fixed");
      await mongoose.connection.close();
      process.exit(0);
    }

    // Find the first admin to assign as creator
    const adminUser = await Admin.findOne();

    if (!adminUser) {
      console.error(
        "❌ No admin user found! Please create an admin user first."
      );
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(
      `\n👤 Will assign admin: ${adminUser.FullName} (${adminUser.email})`
    );
    console.log(`   Admin ID: ${adminUser._id}\n`);

    // Show users to be updated
    console.log("Users to be updated:");
    usersWithoutCreatedBy.forEach((user, index) => {
      console.log(
        `${index + 1}. ${user.userName} (${user.user}) - ID: ${user._id}`
      );
    });

    // Update all users
    const result = await User.updateMany(
      {
        $or: [{ createdBy: null }, { createdBy: { $exists: false } }],
        userType: "user",
      },
      {
        $set: { createdBy: adminUser._id },
      }
    );

    console.log(`\n✅ Updated ${result.modifiedCount} users`);

    // Verify the update
    const verifyUsers = await User.find({
      _id: { $in: usersWithoutCreatedBy.map((u) => u._id) },
    }).populate("createdBy", "FullName email");

    console.log("\n🔍 Verification:");
    verifyUsers.forEach((user, index) => {
      const admin = user.createdBy;
      if (admin) {
        console.log(
          `✓ ${user.userName} -> created by: ${admin.FullName} (${admin.email})`
        );
      } else {
        console.log(`✗ ${user.userName} -> ERROR: No admin linked!`);
      }
    });

    console.log("\n✅ All done! Users have been linked to admin.");

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error fixing users:", error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run the script
console.log("🚀 Starting user migration script...\n");
fixUsersCreatedBy();

// To run this script:
// node scripts/fixUserCreatedBy.js
