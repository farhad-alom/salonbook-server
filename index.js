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

// function সার্ভিসের তথ্য ঠিক আছে কিনা দেখে। ঠিক থাকলে "" ফেরত দেয়, ভুল থাকলে error-এর লেখা ফেরত দেয়
function checkServiceData(body) {
    if (!body.serviceName || !body.category || !body.description || !body.image) {
        return "Please fill in all required fields";
    }
    if (!(Number(body.price) > 0)) {
        return "Price must be a positive number";
    }
    if (!(Number(body.duration) > 0)) {
        return "Duration must be a positive number";
    }
    return "";
}
// Admin: সব সার্ভিস দেখা (active আর inactive দুটোই)
app.get('/api/admin/services', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const result = await serviceCollections.find({}).sort({ createdAt: -1 }).toArray();
        res.send(result);
    }
    catch (error) {
        res.status(500).send({ message: "Failed to load services" })
    }
});

// Admin: নতুন সার্ভিস বানানো
app.post('/api/admin/services', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const body = req.body;
        // তথ্য ঠিক না থাকলে error
        const errorMessage = checkServiceData(body);
        if (errorMessage) {
            return res.status(400).send({ message: errorMessage });
        }
        const newService = {
            serviceName: body.serviceName,
            category: body.category,
            description: body.description,
            price: Number(body.price),
            duration: Number(body.duration),
            image: body.image,
            status: body.status === "inactive" ? "inactive" : "active",
            createdAt: new Date(),
        };
        const result = await serviceCollections.insertOne(newService);
        res.status(201).send(result);
    }
    catch (error) {
        res.status(500).send({ message: "Failed to add service" })
    }
});

// Admin: সার্ভিসের তথ্য বদলানো
app.put('/api/admin/services/:id', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const body = req.body;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid service id" });
        }
        const errorMessage = checkServiceData(body);
        if (errorMessage) {
            return res.status(400).send({ message: errorMessage });
        }
        const result = await serviceCollections.updateOne(
            { _id: new ObjectId(id) },
            {
                $set: {
                    serviceName: body.serviceName,
                    category: body.category,
                    description: body.description,
                    price: Number(body.price),
                    duration: Number(body.duration),
                    image: body.image,
                    status: body.status === "inactive" ? "inactive" : "active",
                },
            }
        );
        // ওই id-র সার্ভিস না পেলে error
        if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Service not found" });
        }

        res.send({ message: "Service updated successfully" });
    } catch (error) {
        res.status(500).send({ message: "Failed to update service" });
    }
});

// Admin: সার্ভিস active বা inactive করা
app.patch('/api/admin/services/:id/status', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;
        const status = req.body.status;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid service id" });
        }

        if (status !== "active" && status !== "inactive") {
            return res.status(400).send({ message: "Status must be active or inactive" });
        }

        const result = await serviceCollections.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: status } }
        );

        if (result.matchedCount === 0) {
            return res.status(404).send({ message: "Service not found" });
        }

        res.send({ message: "Service status updated" });
    } catch (error) {
        res.status(500).send({ message: "Failed to update status" });
    }
});

// Admin: সার্ভিস মুছে ফেলা
app.delete('/api/admin/services/:id', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid service id" });
        }

        const result = await serviceCollections.deleteOne({ _id: new ObjectId(id) });

        // কিছু মোছা না গেলে মানে ওই সার্ভিস ছিল না
        if (result.deletedCount === 0) {
            return res.status(404).send({ message: "Service not found" });
        }

        res.send({ message: "Service deleted successfully" });
    } catch (error) {
        res.status(500).send({ message: "Failed to delete service" });
    }
});

// Customer: নতুন অ্যাপয়েন্টমেন্ট বুকিং
app.post('/api/appointments', verifyJWT, verifyCustomer, async (req, res) => {
    try {
        const { serviceId, date, time, message } = req.body;

        // জরুরি তথ্য না থাকলে error
        if (!serviceId || !date || !time) {
            return res.status(400).send({ message: "Service, date and time are required" });
        }
        if (!ObjectId.isValid(serviceId)) {
            return res.status(400).send({ message: "Invalid service id" });
        }

        // সার্ভিস খোঁজা
        const service = await serviceCollections.findOne({ _id: new ObjectId(serviceId) });
        if (!service) {
            return res.status(404).send({ message: "Service not found" });
        }

        // inactive সার্ভিসে বুকিং বন্ধ
        if (service.status !== "active") {
            return res.status(400).send({ message: "This service is not available now" });
        }

        // একই তারিখ ও সময়ে আগে থেকে বুকিং আছে কিনা (cancelled বাদে)
        const alreadyBooked = await appointmentCollections.findOne({
            date: date,
            time: time,
            status: { $ne: "cancelled" },
        });
        if (alreadyBooked) {
            return res.status(409).send({ message: "This time slot is already booked" });
        }

        // নতুন অ্যাপয়েন্টমেন্ট সেভ
        const newAppointment = {
            serviceId: service._id,
            serviceName: service.serviceName,
            servicePrice: service.price,
            customerEmail: req.user.email,
            customerName: req.user.name,
            date: date,
            time: time,
            message: message || "",
            status: "pending",
            paymentStatus: "unpaid",
            createdAt: new Date(),
        };

        const result = await appointmentCollections.insertOne(newAppointment);
        res.status(201).send(result);
    } catch (error) {
        res.status(500).send({ message: "Failed to book appointment" });
    }
});

// Customer: নিজের সব অ্যাপয়েন্টমেন্ট (সার্ভিসের ছবিসহ)
app.get('/api/appointments', verifyJWT, verifyCustomer, async (req, res) => {
    try {
        const list = await appointmentCollections
            .find({ customerEmail: req.user.email })
            .sort({ createdAt: -1 })
            .toArray();

        // প্রতিটি অ্যাপয়েন্টমেন্টের সার্ভিস থেকে ছবি এনে যোগ করা
        for (const item of list) {
            const service = await serviceCollections.findOne({ _id: item.serviceId });
            item.serviceImage = service ? service.image : "";
        }

        res.send(list);
    } catch (error) {
        res.status(500).send({ message: "Failed to load appointments" });
    }
});

// Customer: ড্যাশবোর্ডের সংখ্যা (মোট, pending, confirmed, cancelled)
app.get('/api/appointments/stats', verifyJWT, verifyCustomer, async (req, res) => {
    try {
        const email = req.user.email;

        const total = await appointmentCollections.countDocuments({ customerEmail: email });
        const pending = await appointmentCollections.countDocuments({ customerEmail: email, status: "pending" });
        const confirmed = await appointmentCollections.countDocuments({ customerEmail: email, status: "confirmed" });
        const cancelled = await appointmentCollections.countDocuments({ customerEmail: email, status: "cancelled" });

        res.send({ total, pending, confirmed, cancelled });
    } catch (error) {
        res.status(500).send({ message: "Failed to load stats" });
    }
});

// Customer: একটি অ্যাপয়েন্টমেন্টের বিস্তারিত (শুধু নিজেরটা)
app.get('/api/appointments/:id', verifyJWT, verifyCustomer, async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid appointment id" });
        }

        // id আর নিজের ইমেইল দুটোই মিলতে হবে
        const appointment = await appointmentCollections.findOne({
            _id: new ObjectId(id),
            customerEmail: req.user.email,
        });

        if (!appointment) {
            return res.status(404).send({ message: "Appointment not found" });
        }

        const service = await serviceCollections.findOne({ _id: appointment.serviceId });
        appointment.serviceImage = service ? service.image : "";

        res.send(appointment);
    } catch (error) {
        res.status(500).send({ message: "Failed to load appointment" });
    }
});

// Customer: শুধু pending অ্যাপয়েন্টমেন্ট cancel করা
app.patch('/api/appointments/:id/cancel', verifyJWT, verifyCustomer, async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid appointment id" });
        }

        const appointment = await appointmentCollections.findOne({
            _id: new ObjectId(id),
            customerEmail: req.user.email,
        });

        if (!appointment) {
            return res.status(404).send({ message: "Appointment not found" });
        }

        // pending না হলে cancel করা যাবে না
        if (appointment.status !== "pending") {
            return res.status(400).send({ message: "Only pending appointments can be cancelled" });
        }

        await appointmentCollections.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "cancelled" } }
        );

        res.send({ message: "Appointment cancelled successfully" });
    } catch (error) {
        res.status(500).send({ message: "Failed to cancel appointment" });
    }
});

// Admin: সব অ্যাপয়েন্টমেন্ট (customer ও সার্ভিসের তথ্যসহ)
app.get('/api/admin/appointments', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const list = await appointmentCollections.find().sort({ createdAt: -1 }).toArray();

        // প্রতিটির সার্ভিস থেকে ছবি ও ক্যাটাগরি যোগ করা
        for (const item of list) {
            const service = await serviceCollections.findOne({ _id: item.serviceId });
            item.serviceImage = service ? service.image : "";
            item.serviceCategory = service ? service.category : "";
        }

        res.send(list);
    } catch (error) {
        res.status(500).send({ message: "Failed to load appointments" });
    }
});

// Admin: Overview-এর সংখ্যা
app.get('/api/admin/stats', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const customers = await userCollections.countDocuments({ role: "customer" });
        const activeServices = await serviceCollections.countDocuments({ status: "active" });
        const total = await appointmentCollections.countDocuments();
        const pending = await appointmentCollections.countDocuments({ status: "pending" });
        const confirmed = await appointmentCollections.countDocuments({ status: "confirmed" });
        const payments = await appointmentCollections.countDocuments({ paymentStatus: "paid" });

        res.send({ customers, activeServices, total, pending, confirmed, payments });
    } catch (error) {
        res.status(500).send({ message: "Failed to load stats" });
    }
});

// Admin: শুধু pending অ্যাপয়েন্টমেন্ট confirm করা
app.patch('/api/admin/appointments/:id/confirm', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid appointment id" });
        }

        const appointment = await appointmentCollections.findOne({ _id: new ObjectId(id) });
        if (!appointment) {
            return res.status(404).send({ message: "Appointment not found" });
        }

        // pending না হলে confirm করা যাবে না
        if (appointment.status !== "pending") {
            return res.status(400).send({ message: "Only pending appointments can be confirmed" });
        }

        await appointmentCollections.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "confirmed" } }
        );

        res.send({ message: "Appointment confirmed successfully" });
    } catch (error) {
        res.status(500).send({ message: "Failed to confirm appointment" });
    }
});

// Admin: pending বা confirmed অ্যাপয়েন্টমেন্ট cancel করা
app.patch('/api/admin/appointments/:id/cancel', verifyJWT, verifyAdmin, async (req, res) => {
    try {
        const id = req.params.id;

        if (!ObjectId.isValid(id)) {
            return res.status(400).send({ message: "Invalid appointment id" });
        }

        const appointment = await appointmentCollections.findOne({ _id: new ObjectId(id) });
        if (!appointment) {
            return res.status(404).send({ message: "Appointment not found" });
        }

        // আগেই cancelled হলে আবার cancel করা যাবে না
        if (appointment.status === "cancelled") {
            return res.status(400).send({ message: "Appointment is already cancelled" });
        }

        await appointmentCollections.updateOne(
            { _id: new ObjectId(id) },
            { $set: { status: "cancelled" } }
        );

        res.send({ message: "Appointment cancelled successfully" });
    } catch (error) {
        res.status(500).send({ message: "Failed to cancel appointment" });
    }
});

app.listen(port, () => {
    console.log(`The server is running on port: ${port}`);
});
