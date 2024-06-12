const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 9000;

// middlewares
const corsOptions = {
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "https://shaadidotcom-af40a.web.app",
    "https://shaadidotcom-af40a.firebaseapp.com",
  ],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.fi65pdm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    // All collections
    const usersCollection = client.db("shaddiDotCom").collection("users");
    const successStoryCollection = client
      .db("shaddiDotCom")
      .collection("successStory");
    const bioDataCollection = client.db("shaddiDotCom").collection("bioData");
    const premiumMembersCollection = client
      .db("shaddiDotCom")
      .collection("premiumMembers");
    const makePremiumCollection = client
      .db("shaddiDotCom")
      .collection("makePremium");
    const favoritesBiodataCollection = client
      .db("shaddiDotCom")
      .collection("favoritesBiodata");
    const contactRequestCollection = client
      .db("shaddiDotCom")
      .collection("contactRequest");

    // Verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const isAdmin = user.role === "admin";
      if (!isAdmin) {
        return res.status(401).send({ message: "unauthorized access!" });
      }
      next();
    };

    // jwt related api--------------------
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    // user related api-------------------
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "unauthorized access" });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user?.email };
      const isExist = await usersCollection.findOne(query);
      if (isExist) return res.send(isExist);
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(query, updateDoc, options);
      res.send(result);
    });

    app.patch("/makePremiumUser/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          type: "premium",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.patch(
      "/users/update/:email",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.params.email;
        const user = req.body;
        const query = { email };
        const updateDoc = {
          $set: { ...user, timestamp: Date.now() },
        };
        const result = await usersCollection.updateOne(query, updateDoc);
        res.send(result);
      }
    );

    // bioData related api----------------------

    app.get("/bioData", async (req, res) => {
      const result = await bioDataCollection.find().toArray();
      res.send(result);
    });

    app.get("/bioData/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bioDataCollection.findOne(query);
      res.send(result);
    });

    app.get("/usersBioData/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email };
      const result = await bioDataCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/bioData", async (req, res) => {
      const item = req.body;
      const lastBioDataId = await bioDataCollection.estimatedDocumentCount();
      const newBioDataId = parseInt(lastBioDataId) + 1;
      const newItem = {
        bioDataId: newBioDataId,
        ...item,
      };
      const result = await bioDataCollection.insertOne(newItem);
      res.send(result);
    });

    app.delete("/bioData/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await bioDataCollection.deleteOne(query);
      res.send(result);
    });

    // successStory related api------------------------
    app.get("/successStory", async (req, res) => {
      const result = await successStoryCollection.find().toArray();
      res.send(result);
    });

    // contact Request related api..........................
    app.post("/contactRequest", async (req, res) => {
      const contactReq = req.body;

      const query = { bioDataId: contactReq.bioDataId };
      const isExist = await contactRequestCollection.findOne(query);
      if (isExist) return res.send(isExist);

      const result = await contactRequestCollection.insertOne(contactReq);
      res.send(result);
    });

    app.get("/contactRequest", async (req, res) => {
      const result = await contactRequestCollection.find().toArray();
      res.send(result);
    });

    app.get("/contactRequest/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await contactRequestCollection.find(query).toArray();
      res.send(result);
    });

    app.patch("/contactRequest/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: "verified",
        },
      };
      const result = await contactRequestCollection.updateOne(
        filter,
        updateDoc
      );
      res.send(result);
    });

    // payment related------------------------
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    // premium members related api--------------------

    app.get("/makePremium", async (req, res) => {
      const result = await makePremiumCollection.find().toArray();
      res.send(result);
    });

    app.post("/makePremium", async (req, res) => {
      const data = req.body;
      const result = await makePremiumCollection.insertOne(data);
      res.send(result);
    });

    app.patch("/bioData/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          type: "premium",
        },
      };
      const result = await bioDataCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    app.patch("/makePremium/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: id };
      const updatedDoc = {
        $set: {
          type: "premium",
        },
      };
      const result = await makePremiumCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

    // -------------------------------
    app.get("/premiumMembers", async (req, res) => {
      const result = await premiumMembersCollection.find().toArray();
      res.send(result);
    });
    app.get("/premiumMembers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await premiumMembersCollection.findOne(query);
      res.send(result);
    });
    // --------------------------------------------------------------------

    // favorites biodata related api
    app.post("/favoritesBiodata", async (req, res) => {
      const bioData = req.body;
      const query = { bioDataId: bioData.bioDataId };
      const isExist = await favoritesBiodataCollection.findOne(query);
      if (isExist) return res.send(isExist);
      const result = await favoritesBiodataCollection.insertOne(bioData);
      res.send(result);
    });

    app.get("/favoritesBiodata/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await favoritesBiodataCollection.find(query).toArray();
      res.send(result);
    });

    app.delete("/favoritesBiodata/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await favoritesBiodataCollection.deleteOne(query);
      res.send(result);
    });

    // stats or analytics
    app.get("/admin-stats", async (req, res) => {
      const users = await usersCollection.estimatedDocumentCount();
      const bioData = await bioDataCollection.estimatedDocumentCount();
      const makePremium = await makePremiumCollection.estimatedDocumentCount();
      const contactRequest =
        await contactRequestCollection.estimatedDocumentCount();

      res.send({
        users,
        bioData,
        makePremium,
        contactRequest,
      });
    });
    // ----------------------------------------------
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    ("Pinged your deployment. You successfully connected to MongoDB!");
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
app.get("/", (req, res) => {
  res.send("Shaddi.com is running.......");
});
app.listen(port, () => {
  console.log(`Server running on the port, ${port}`);
});
