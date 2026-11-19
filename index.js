import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { MongoClient } from "mongodb";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());
// ডাটাবেজ কানেকশন 
const client = new MongoClient(process.env.MONGODB_URI);

export async function connectToMongoDB() {
    try {
        await client.connect();
        console.log("You successfully connected to MongoDB!");
        return client;
    } catch (err) {
        console.dir(err);
    }
}

const connectedClient = await connectToMongoDB();
const database = connectedClient.db("salonbook");
const userCollections = database.collection("users");
const serviceCollections = database.collection("services");
const appointmentCollections = database.collection("appointments");
const transactionCollections = database.collection("transactions");


async function verifyJWT(req, res, next) {
    const authHeader = req.headers.authorization;

    // টোকেন না থাকলে আটকে দাও
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({ message: "Unauthorized: token is missing" });
    }

    const token = authHeader.split(" ")[1];

    try {
        // টোকেন ঠিক কিনা যাচাই
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // টোকেনের ইমেইল দিয়ে ডাটাবেজ থেকে ইউজার খোঁজা
        const user = await userCollections.findOne({ email: decoded.email });

        if (!user) {
            return res.status(401).send({ message: "Unauthorized: user not found" });
        }

        // ব্লক করা ইউজারকে আটকে দাও
        if (user.isBlocked) {
            return res.status(403).send({ message: "Your account has been blocked" });
        }

        req.user = user; // ইউজারের তথ্য পরের ফাংশনের জন্য রেখে দেওয়া
        next(); // সব ঠিক, ভেতরে ঢুকতে দাও
    } catch (error) {
        return res.status(401).send({ message: "Unauthorized: invalid or expired token" });
    }
}

// পাহারাদার ২: শুধু admin ঢুকতে পারবে
function verifyAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden: admin access only" });
    }
    next();
}

// পাহারাদার ৩: শুধু customer ঢুকতে পারবে
function verifyCustomer(req, res, next) {
    if (req.user.role !== "customer") {
        return res.status(403).send({ message: "Forbidden: customer access only" });
    }
    next();
}


app.get('/', (req, res) => {
    res.send('Hello World!');
});

app.get('/api/servies', (req, res) => {

    res.send();
});

app.listen(port, () => {
    console.log(`The server is running on port: ${port}`);
});
