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


// ====================================================
// ফেজ ৭: JWT ও Role যাচাইয়ের Middleware
// ====================================================

// ১. verifyJWT — টোকেন ঠিক আছে কিনা দেখে, ইউজার ডাটাবেজে আছে কিনা দেখে,
//    আর ব্লক করা কিনা সেটিও দেখে। সব ঠিক থাকলে req.user-এ ইউজারের তথ্য রেখে দেয়।
async function verifyJWT(req, res, next) {
    // টোকেন আসে "Authorization: Bearer টোকেন" আকারে
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).send({ message: "Unauthorized: token is missing" });
    }

    const token = authHeader.split(" ")[1];

    try {
        // টোকেন যাচাই করা (ভুল বা মেয়াদ শেষ হলে এখানেই error হবে)
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // টোকেনের ইমেইল দিয়ে ডাটাবেজ থেকে ইউজার খোঁজা
        const user = await userCollections.findOne({ email: decoded.email });

        if (!user) {
            return res.status(401).send({ message: "Unauthorized: user not found" });
        }

        // ব্লক করা ইউজার ঢুকতে পারবে না
        if (user.isBlocked) {
            return res.status(403).send({ message: "Your account has been blocked" });
        }

        req.user = user; // পরের ফাংশনগুলো req.user ব্যবহার করতে পারবে
        next();
    } catch (error) {
        return res.status(401).send({ message: "Unauthorized: invalid or expired token" });
    }
}

// ২. verifyAdmin — শুধু admin ঢুকতে পারবে (verifyJWT-এর পরে বসাতে হবে)
function verifyAdmin(req, res, next) {
    if (req.user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden: admin access only" });
    }
    next();
}

// ৩. verifyCustomer — শুধু customer ঢুকতে পারবে (verifyJWT-এর পরে বসাতে হবে)
function verifyCustomer(req, res, next) {
    if (req.user.role !== "customer") {
        return res.status(403).send({ message: "Forbidden: customer access only" });
    }
    next();
}


// ====================================================
// রুট (API)
// ====================================================

app.get('/', (req, res) => {
    res.send('Hello World!');
});

// ---- ফেজ ৭ পরীক্ষার জন্য (পরীক্ষা শেষে এই ৩টি রুট মুছে ফেলবেন) ----
app.get('/api/test/protected', verifyJWT, (req, res) => {
    res.send({ message: "Token is valid", email: req.user.email, role: req.user.role });
});

app.get('/api/test/admin', verifyJWT, verifyAdmin, (req, res) => {
    res.send({ message: "Welcome admin" });
});

app.get('/api/test/customer', verifyJWT, verifyCustomer, (req, res) => {
    res.send({ message: "Welcome customer" });
});
// ---- পরীক্ষার রুট শেষ ----

app.get('/api/servies', (req, res) => {


    res.send();
});

app.listen(port, () => {
    console.log(`The server is running on port: ${port}`);
});



// app.get('/users', async (req, res) => {
//     const cursor = userCollections.find({});
//     const result = await cursor.toArray();
//     res.send(result);
// });
