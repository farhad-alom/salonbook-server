import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import { MongoClient, ObjectId } from "mongodb";

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

// সব active সার্ভিস দেখানো (search, category, sort সহ)
app.get('/api/services', async (req, res) => {
    try {
        const { search, category, sort } = req.query;
        const query = { status: "active" };

        if (typeof search === "string" && search.trim()) {
            const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            query.serviceName = { $regex: safeSearch, $options: "i" };
        }

        if (typeof category === "string" && category.trim()) {
            query.category = category.trim();
        }

        let sortOption = {};
        if (typeof sort === "string") {
            if (sort === "asc") {
                sortOption = { price: 1 };
            }
            if (sort === "desc") {
                sortOption = { price: -1 };
            }
        }

        const result = await serviceCollections.find(query).sort(sortOption).toArray();
        res.send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to load services" });
    }
});

// the latest 6 items services
app.get('/api/services/featured', async (req, res) => {
    try {
        const result = await serviceCollections.find({ status: "active" })
            .sort({ createdAt: -1 }).limit(6).toArray();
        res.send(result);
    }
    catch (error) {
        res.status(500).send({ message: "Failed to load featured services" })
    }
});

// একটা নির্দিষ্ট সার্ভিস id দিয়ে খোঁজা
app.get('/api/services/:id', async (req, res) => {
    try {
        const id = req.params.id;

        // id-এর আকার ঠিক না হলে error
        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid service id" });
        }

        const service = await serviceCollections.findOne({ _id: new ObjectId(id) });

        // ডাটাবেজে না পেলে error
        if (!service) {
            return res.status(404).send({ message: "Service not found" });
        }
        res.send(service);
    } catch (error) {
        res.status(500).send({ message: "Failed to load service" });
    }
});
app.listen(port, () => {
    console.log(`The server is running on port: ${port}`);
});
