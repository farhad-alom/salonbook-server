// শুধু পরীক্ষার জন্য — টেস্ট টোকেন বানায়। পরীক্ষা শেষে এই ফাইল মুছে ফেলবেন।
// চালানোর নিয়ম:  node makeToken.js ইউজারের-ইমেইল
import dotenv from "dotenv";
import jwt from "jsonwebtoken";

dotenv.config();

const email = process.argv[2];

if (!email) {
    console.log("Please give an email. Example: node makeToken.js user@gmail.com");
} else {
    const token = jwt.sign({ email: email }, process.env.JWT_SECRET, { expiresIn: "1h" });
    console.log(token);
}
