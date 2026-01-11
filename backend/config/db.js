const mongoose = require("mongoose");

const colors = require("colors");

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);
    console.log(
      `connected Successfully ${mongoose.connection.host}`.bgMagenta.white
    );
  } catch (error) {
    console.log(`error in connection ${error}`.bgRed.white);
  }
};


module.exports = connectDB