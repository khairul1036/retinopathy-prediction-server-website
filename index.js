const express = require("express");
const { MongoClient, ServerApiVersion } = require("mongodb");
const cors = require("cors");
const { default: axios } = require("axios");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

const uri = `mongodb+srv://retinaDB:${process.env.DB_PASS}@cluster0.ah9aw.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(`${process.env.GEMINI_API_KEY}`);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

//middleware
app.use(cors());
app.use(express.json());

// app.get("/text", async (req, res) => {
//   const prompt = "give me suggestion on retina Central Serous Chorioretinopathy disease. write text in english and bangla languages.";

//   const result = await model.generateContent(prompt);
//   console.log(result.response.text());

//   res.send(result.response.text());
// });

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );

    // Create database
    const database = client.db("RetinaDB");
    const retinaDiseasesCollection = database.collection(
      "user-diseases-detection"
    );

    app.get("/all-detected-image", async (req, res) => {
        // Get the email from query parameters
        const { email } = req.query; 
      
        if (!email) {
          return res.status(400).send({ message: "Email is required" });
        }
      
        try {
          // Find documents where the 'user_email' matches the provided email
          const result = await retinaDiseasesCollection
            .find({ user_email: email })  // Filter by 'user_email'
            .project({ user_email: 0 })   // Exclude the 'user_email' field
            .toArray();
      
          res.send(result);  // Send the filtered data
        } catch (error) {
          console.error(error);
          res.status(500).send({ message: "An error occurred while fetching the data." });
        }
      });
      

    // Define the POST endpoint to receive the image URL and make a prediction and store database
    app.post("/predict-image", async (req, res) => {
      try {
        const { user_name, user_email, image_url } = req.body;

        if (!image_url) {
          return res.status(400).json({ message: "No image_url provided" });
        }

        // Make a request to your prediction service (this could be an external API or own model)
        const predictionResponse = await axios.post(
          "http://127.0.0.1:5000/predict",
          { image_url }
        );

        const result = await generateTextForDisease(predictionResponse);

        const predicted_class = predictionResponse.data.predicted_class;
        // console.log(predicted_class);

        const insertData = await retinaDiseasesCollection.insertOne({
          user_name,
          user_email,
          image_url,
          predicted_class,
          english: result.english,
          bangla: result.bangla,
          createAt: new Date(),
        });

        // Return the prediction response to the client
        return res.json({
          predicted_class,
          english: result.english,
          bangla: result.bangla,
        });
      } catch (error) {
        console.error("Error handling prediction:", error);
        return res.status(500).json({ message: "Internal server error" });
      }
    });

    // Generates suggestions based on the disease
    async function generateTextForDisease(predicted_disease) {
      try {
        const prompt = `give me suggestion on retina ${predicted_disease} disease. write text in english and bangla languages.`;
        // Assuming you have a model or service to generate the content
        const result = await model.generateContent(prompt);
        const fullResponse = result.response.text();

        // Splitting the response into English and Bangla parts
        const englishStart = fullResponse.indexOf("**English:**");
        const banglaStart = fullResponse.indexOf("**Bangla:**");

        let englishText = fullResponse
          .slice(englishStart + 11, banglaStart)
          .trim();
        let banglaText = fullResponse.slice(banglaStart + 9).trim();

        // Remove the disclaimer part (if present)
        const disclaimerStart = banglaText.indexOf("**Disclaimer:");
        if (disclaimerStart !== -1) {
          banglaText = banglaText.slice(0, disclaimerStart).trim();
        }

        return { english: englishText, bangla: banglaText };
      } catch (error) {
        throw new Error("Error generating content: " + error.message);
      }
    }
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
