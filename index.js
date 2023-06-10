const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

//midlewares
app.use(express.json());
app.use(cors());
const stripe = require('stripe')(process.env.PAYMENT_SECRET)
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.obhdclo.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const instructorCollection = client.db("tuneYoDb").collection("instructors")
        const usersCollection = client.db("tuneYoDb").collection("users");
        // const classCollection = client.db("tuneYoDb").collection("classes");
        const selectedClassCollection = client.db("tuneYoDb").collection("selectedclasses");
        const paymentClassCollection = client.db("tuneYoDb").collection("payments");

        //instructors api
        app.get("/instructors", async (req, res) => {
            const result = await instructorCollection.find().toArray();
            res.send(result)
        })

        // users apis
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            res.send(result);
        });

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User allready exists" })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        // classe apis
        app.get("/classes", async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result)
        })

        app.post("/classes", async (req, res) => {
            const newClass = req.body;
            const result = await classCollection.insertOne(newClass)
            res.send(result)
        })

        app.put("/classes/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedClass = req.body;
            const newUpdatedClass = {
                $set: {
                    className: updatedClass.className,
                    classImage: updatedClass.classImage,
                    availableSeats: updatedClass.availableSeats,
                    price: updatedClass.price,
                    status: updatedClass.status,
                    feedback: updatedClass.feedback
                }
            }
            const result = await classCollection.updateOne(query, newUpdatedClass, options);
            res.send(result)

        })

        app.patch('/classes/:className', async (req, res) => {
            const className = req.params.className;

            try {
                const result = await classCollection.updateOne(
                    { className },
                    { $inc: { availableSeats: -1, enrolled: 1 } }
                );

                if (result.matchedCount === 1 && result.modifiedCount === 1) {
                    res.status(200).json({ message: 'Successfully updated availableSeats.' });
                } else if (result.matchedCount === 0) {
                    res.status(404).json({ message: 'Class not found.' });
                } else {
                    res.status(500).json({ message: 'Failed to update availableSeats.' });
                }
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'An error occurred while updating availableSeats.' });
            }
        });


        app.patch('/classes/:id', async (req, res) => {
            const id = req.params.id;
            try {
                const result = await classCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status: 'approved' } }
                );

                if (result.matchedCount === 1 && result.modifiedCount === 1) {
                    res.status(200).json({ message: 'Successfully updated status.' });
                } else if (result.matchedCount === 0) {
                    res.status(404).json({ message: 'Class not found.' });
                } else {
                    res.status(500).json({ message: 'Failed to update status.' });
                }
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'An error occurred while updating status.' });
            }
        });

        app.get("/classes/toupdate/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await classCollection.findOne(query);
            res.send(result)
        })
        app.get("/classes/:email", async (req, res) => {
            try {
                const email = req.params.email;
                if (!email) {
                    res.send([]);
                }
                const query = {
                    instructorEmail: email
                };
                const result = await classCollection.find(query).toArray();
                res.send(result);
            }
            catch (error) {
                console.error("Error retrieving selected classes:", error);
                res.status(500).send("Internal Server Error");
            }
        });



        //selected classes apis
        app.post("/selectedclasses", async (req, res) => {
            const { selectedClass, email } = req.body;
            const query = { className: selectedClass.className, studentEmail: email };
            const existingClass = await selectedClassCollection.findOne(query);
            if (existingClass) {
                return res.send({ message: "Class allready exists" })
            }
            const result = await selectedClassCollection.insertOne(selectedClass)
            res.send(result)
        })
        app.patch('/selectedclasses/:id', async (req, res) => {
            const id = req.params.id;
            const type = "paid"
            const filter = { _id: new ObjectId(id) }
            const UpdateDoc = {
                $set: {
                    type: type
                }
            }
            const result = await selectedClassCollection.updateOne(filter, UpdateDoc);
            res.send(result)
        })
        app.get("/selectedclasses", async (req, res) => {
            const result = await selectedClassCollection.find().toArray();
            res.send(result);
        })
        app.get("/selectedclasses/:id", async (req, res) => {
            const id = req.params.id;
            if (!ObjectId.isValid(id)) {
                return res.status(400).send("Invalid class ID");
            }
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.findOne(query);
            if (!result) {
                return res.status(404).send("Class not found");
            }
            res.send(result);
        });

        app.get("/selectedclasses/student/:email", async (req, res) => {
            try {
                const email = req.params.email;
                if (!email) {
                    res.send([]);
                }
                const query = {
                    studentEmail: email
                };
                const result = await selectedClassCollection.find(query).toArray();
                res.send(result);
            }
            catch (error) {
                console.error("Error retrieving selected classes:", error);
                res.status(500).send("Internal Server Error");
            }
        });




        app.delete("/selectedclasses/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectedClassCollection.deleteOne(query);
            res.send(result);
        })


        //payment related apis
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;
            console.log(price, amount);
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                "payment_method_types": ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            })
        })

        app.post("/payments", async (req, res) => {
            const newPayment = req.body;
            const result = await paymentClassCollection.insertOne(newPayment)
            res.send(result)
        })
        app.get("/payments/:email", async (req, res) => {
            try {
                const email = req.params.email;
                if (!email) {
                    res.send([]);
                }
                const query = {
                    email: email
                };
                const result = await paymentClassCollection.find(query).sort({ _id: -1 }).toArray();
                res.send(result);
            }
            catch (error) {
                console.error("Error retrieving selected classes:", error);
                res.status(500).send("Internal Server Error");
            }
        });



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send("TuneYo server is running")
})

app.listen(port)