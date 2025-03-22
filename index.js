const express = require("express");
const cors = require("cors");
const { default: axios } = require("axios");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

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

// Define the POST endpoint to receive the image URL and make a prediction
app.post("/predict-image", async (req, res) => {
  try {
    const { image_url } = req.body;

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
    console.log(predicted_class);

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

    let englishText = fullResponse.slice(englishStart + 11, banglaStart).trim();
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

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
