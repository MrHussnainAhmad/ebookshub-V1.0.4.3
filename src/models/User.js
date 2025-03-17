import mongoose from "mongoose";
import bcrypt from "bcryptjs";


const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  profileImage: {
    type: String,
    default: "",
  },  userType: {
    type: String,
    enum: ["reader", "author"], // Restrict to two roles
    required: true,
    default: "reader",
  },
},{timestamps: true});
//compare passwords:
userSchema.methods.comparePassword = async function(password){

  return await bcrypt.compare(password, this.password);
}
//hash the pass:
userSchema.pre("save", async function(next){
  if(!this.isModified("password")){
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password,salt)

  next();
})

const user = mongoose.model("User", userSchema);


export default user;