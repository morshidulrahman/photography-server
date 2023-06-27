const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const stripe = require("stripe")(process.env.SCRETE_KEY);
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("photography is running");
});

const verifyJwt = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({
      error: true,
      message: "unauthorized access",
    });
  }
  const token = authorization.split(" ")[1];
  jwt.verify(token, process.env.JWT_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({
        error: true,
        message: "unauthorized access",
      });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER_PHOTOGHOR}:${process.env.DB_PASSWORD_PHOTOTGHOR}@cluster0.apzeojt.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const dbConnect = async () => {
  try {
    client.connect();
    console.log("Database Connected Successfully");
  } catch (error) {
    console.log(error.name, error.message);
  }
};
dbConnect();

// Connect the client to the server	(optional starting in v4.7)

const classesCollection = client.db("PhotoghorDB").collection("classes");
const payemntsCollection = client.db("PhotoghorDB").collection("payments");
const usersCollection = client.db("PhotoghorDB").collection("users");
const selectedclassesCollection = client
  .db("PhotoghorDB")
  .collection("selectedClasses");
const instructorsCollection = client
  .db("PhotoghorDB")
  .collection("instructors");

app.post("/jwt", async (req, res) => {
  const user = req.body;
  var token = jwt.sign(user, process.env.JWT_TOKEN, { expiresIn: "1h" });
  res.send({ token });
});

const verifyAdminJwt = async (req, res, next) => {
  const email = req.decoded.email;
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  if (user?.role !== "admin") {
    return res.status(403).send({
      error: true,
      message: "unauthorized access",
    });
  }
  next();
};

// add user in database
app.post("/users", async (req, res) => {
  const user = req.body;
  const query = { email: user.email };
  const existingusers = await usersCollection.findOne(query);
  if (existingusers) {
    return res.send({
      message: "User already exists",
    });
  }
  const result = await usersCollection.insertOne(user);
  res.send(result);
});

app.get("/users", verifyJwt, verifyAdminJwt, async (req, res) => {
  const result = await usersCollection.find().toArray();
  res.send(result);
});

app.patch("/users/admin/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: "admin",
    },
  };
  const result = await usersCollection.updateOne(query, updateDoc);

  res.send(result);
});

app.patch("/users/instructor/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const updateDoc = {
    $set: {
      role: "instructor",
    },
  };
  const result = await usersCollection.updateOne(query, updateDoc);

  res.send(result);
});

app.get("/users/admin/:email", verifyJwt, async (req, res) => {
  const email = req.params.email;
  if (req.decoded.email !== email) {
    res.send({ admin: false });
  }
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const result = { admin: user?.role === "admin" };
  res.send(result);
});

app.get("/users/instructor/:email", verifyJwt, async (req, res) => {
  const email = req.params.email;
  if (req.decoded.email !== email) {
    res.send({ instructor: false });
  }
  const query = { email: email };
  const user = await usersCollection.findOne(query);
  const result = { instructor: user?.role === "instructor" };
  res.send(result);
});

app.delete("/users/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await usersCollection.deleteOne(query);
  res.send(result);
});

app.get("/classes", async (req, res) => {
  const classes = await classesCollection.find().toArray();
  res.send(classes);
});

app.patch("/classes/:id", async (req, res) => {
  const id = req.params.id;
  const query = req.query.status;
  const upquery = {
    _id: new ObjectId(id),
  };
  const updateDoc = {
    $set: {
      status: query,
    },
  };
  const classes = await classesCollection.updateOne(upquery, updateDoc);
  res.send(classes);
});

app.patch("/feedbackclasses/:id", async (req, res) => {
  const id = req.params.id;
  const query = req.body.message;
  const upquery = {
    _id: new ObjectId(id),
  };
  const updateDoc = {
    $set: {
      feedback: query,
    },
  };
  const classes = await classesCollection.updateOne(upquery, updateDoc);
  res.send(classes);
});

app.post("/classes", verifyJwt, async (req, res) => {
  const newClass = req.body;
  const classes = await classesCollection.insertOne(newClass);
  res.send(classes);
});

app.get("/myclasses", verifyJwt, async (req, res) => {
  const email = req.query.email;
  if (!email) {
    res.send([]);
  }
  const decodedemail = req.decoded.email;
  if (decodedemail != email) {
    return res.status(403).send({
      error: true,
      message: "porbiden access",
    });
  }
  const qurey = { instructorEmail: email };
  const result = await classesCollection.find(qurey).toArray();
  res.send(result);
});

app.get("/enrolledclasses", verifyJwt, async (req, res) => {
  const email = req.query.email;
  if (!email) {
    res.send([]);
  }
  const decodedemail = req.decoded.email;
  if (decodedemail != email) {
    return res.status(403).send({
      error: true,
      message: "porbiden access",
    });
  }
  const qurey = { email: email };
  const result = await classesCollection.find(qurey).toArray();
  res.send(result);
});

app.get("/instructors", async (req, res) => {
  const classes = await instructorsCollection.find().toArray();
  res.send(classes);
});

app.post("/selectedclasses", async (req, res) => {
  const selectclasses = req.body;
  const result = await selectedclassesCollection.insertOne(selectclasses);
  res.send(result);
});

app.get("/selectedclasses", verifyJwt, async (req, res) => {
  const email = req.query.email;
  if (!email) {
    res.send([]);
  }
  const decodedemail = req.decoded.email;
  if (decodedemail != email) {
    return res.status(403).send({
      error: true,
      message: "porbiden access",
    });
  }
  const qurey = { email: email };
  const result = await selectedclassesCollection.find(qurey).toArray();
  res.send(result);
});

// deelet cart items
app.delete("/selectedclasses/:id", async (req, res) => {
  const id = req.params.id;
  const query = { _id: new ObjectId(id) };
  const result = await selectedclassesCollection.deleteOne(query);
  res.send(result);
});

app.post("/create-payment-intent", async (req, res) => {
  const { price } = req.body;
  const amount = price * 100;
  // Create a PaymentIntent with the order amount and currency
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amount,
    currency: "usd",
    payment_method_types: ["card"],
  });

  res.send({
    clientSecret: paymentIntent.client_secret,
  });
});

app.post("/payments", async (req, res) => {
  const payment = req.body;
  const result = await payemntsCollection.insertOne(payment);
  const query = {
    selectedClassesid: payment.selectedclassId,
  };

  const upquery = {
    _id: new ObjectId(payment.selectedclassId),
  };
  const updateDoc = {
    $set: {
      email: payment.email,
      pstatus: "success",
      availableSeats: payment.availableSeats - 1,
      numberOfStudents: payment.numberOfStudents + 1,
    },
  };
  const updatedresults = await classesCollection.updateOne(upquery, updateDoc);
  const deletResult = await selectedclassesCollection.deleteOne(query);
  res.send({ result, deletResult, updatedresults });
});

app.get("/payments", async (req, res) => {
  const email = req.query.email;
  const qurey = { email: email };
  const result = await payemntsCollection.find(qurey).toArray();
  res.send(result);
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
