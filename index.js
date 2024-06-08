const express = require("express");
const cors = require("cors");
require("dotenv").config();
const cookieParser = require("cookie-parser");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
const port = process.env.PORT || 9000;

// middlewares
const corsOptions = {
  origin: ["http://localhost:5173", "http://localhost:5174"],
  credentials: true,
  optionSuccessStatus: 200,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Verify Token Middleware
const verifyToken = async (req, res, next) => {
  console.log("inside inside inside", req.headers.authorization);

  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      console.log(err);
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

    const usersCollection = client.db("shaddiDotCom").collection("users");
    const successStoryCollection = client
      .db("shaddiDotCom")
      .collection("successStory");
    const bioDataCollection = client.db("shaddiDotCom").collection("bioData");
    const premiumMembersCollection = client
      .db("shaddiDotCom")
      .collection("premiumMembers");

    // Verify admin middleware
    const verifyAdmin = async (req, res, next) => {
      const user = req.user;
      const query = { email: user?.email };
      const result = await usersCollection.findOne(query);
      if (!result || result?.role !== "admin") {
        return res.status(401).send({ message: "unauthorized access!" });
      }
      next();
    };

    // jwt related api
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "7d",
      });
      res.send({ token });
    });

    // Logout
    app.get("/logout", async (req, res) => {
      try {
        res
          .clearCookie("token", {
            maxAge: 0,
            secure: process.env.NODE_ENV === "production",
            sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
          })
          .send({ success: true });
        console.log("Logout successful");
      } catch (err) {
        res.status(500).send(err);
      }
    });

    // user relayed api--------------------------------------
    app.get("/users", verifyToken, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get("/users/admin/:email", async (req, res) => {
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
      // check if user already exist in db
      const isExist = await usersCollection.findOne(query);
      if (isExist) return res.send(isExist);

      const options = { upsert: true };
      const updaterDoc = {
        $set: {
          ...user,
          timestamp: Date.now(),
        },
      };
      const result = await usersCollection.updateOne(
        query,
        updaterDoc,
        options
      );
      res.send(result);
    });

    app.patch("/users/update/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const query = { email };
      const updateDoc = {
        $set: { ...user, timestamp: Date.now() },
      };
      const result = await usersCollection.updateOne(query, updateDoc);
      res.send(result);
    });

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

    // app.put("/bioData", async (req, res) => {
    //   const bioData = req.body;
    //   const lastBioDataId = await bioDataCollection.estimatedDocumentCount();
    //   const newBioDataId = parseInt(lastBioDataId) + 1;
    //   const newBioData = {
    //     bioDataId: newBioDataId,
    //     ...bioData,
    //   };
    //   const query = { bioDataId: newBioDataId };
    //   const options = { upsert: true };
    //   const updaterDoc = {
    //     $set: {
    //       ...newBioData,
    //     },
    //   };
    //   const result = await bioDataCollection.updateOne(
    //     query,
    //     updaterDoc,
    //     options
    //   );
    //   res.send(result);
    // });

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

    // premium members related api--------------------
    app.get("/premiumMembers", async (req, res) => {
      const result = await premiumMembersCollection.find().toArray();
      res.send(result);
    });

    // premium members related api
    app.get("/premiumMembers/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await premiumMembersCollection.findOne(query);
      res.send(result);
    });
    // --------------------------------------------------------------------
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
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
