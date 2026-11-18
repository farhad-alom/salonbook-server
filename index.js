import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(express.json());
app.use(cors());

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



app.get('/', (req, res) => {
    res.send('Hello World!');
});


app.listen(port, () => {
    console.log(`The server is running on port: ${port}`);
});



// app.get('/users', async (req, res) => {
//     const cursor = userCollections.find({});
//     const result = await cursor.toArray();
//     res.send(result);
// });