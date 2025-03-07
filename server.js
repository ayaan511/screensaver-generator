const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { exec } = require("child_process");

dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Detect user OS for correct file format
const detectOS = () => {
    const platform = os.platform();
    return platform === "win32" ? ".scr" : platform === "darwin" ? ".saver" : null;
};

// Route to generate a screensaver
app.post("/generate", async (req, res) => {
    const { screensaverType } = req.body;
    if (!screensaverType) return res.status(400).json({ error: "Missing screensaver type!" });

    console.log(`🖥️ Generating screensaver: ${screensaverType}`);

    try {
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4o",
                messages: [{ 
    role: "user", 
    content: `Only return the raw Python code with NO markdown, NO triple backticks (\`\`\`), NO "python" keyword, NO explanations, and NO extra text. Just return the Python script only. Generate a Python script using Pygame that creates a ${screensaverType} screensaver.`
}],            },
            { headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" } }
        );

        const screensaverCode = response.data.choices[0].message.content.trim();
        const screensaverFile = path.join(__dirname, "generated_screensaver.py");
        fs.writeFileSync(screensaverFile, screensaverCode);

        console.log("✅ Screensaver Python script saved.");

        // Convert to correct OS format
        const outputFormat = detectOS();
        if (!outputFormat) return res.status(400).json({ error: "Unsupported OS!" });

        console.log(`🔄 Converting to ${outputFormat}...`);
        let command;
        if (outputFormat === ".scr") {
            command = `pyinstaller --onefile --noconsole --name=screensaver ${screensaverFile} && ren dist\\screensaver.exe dist\\screensaver.scr`;
        } else if (outputFormat === ".saver") {
            command = `py2app -A -o screensaver.app ${screensaverFile}`;
        }

        exec(command, (error) => {
            if (error) {
                console.error("❌ Conversion failed:", error);
                return res.status(500).json({ error: "Conversion failed" });
            }

            const screensaverPath = path.join(__dirname, "dist", `screensaver${outputFormat}`);
            console.log(`✅ Screensaver ready: ${screensaverPath}`);
            res.download(screensaverPath);
        });

    } catch (error) {
        console.error("❌ OpenAI API error:", error);
        res.status(500).json({ error: "Failed to generate screensaver." });
    }
});

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
