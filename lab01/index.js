const express = require('express');
const cors = require('cors');

let app = express();
app.use(cors());

// add routes here

app.get('/', function (req, res) {
    res.json({
        "message": "hello world"
    });
})

app.get('/hello/:name', (req, res) => {
    let name = req.params.name;
    res.send("Hi, " + name);
})

app.get('/echo', (req, res) => {
    // Get all query parameters
    const queryParams = req.query;

    // Create a response object
    const response = {
        message: "Here are the query parameters you sent:",
        firstName: queryParams.firstName,
        lastName: queryParams.lastName
    };

    res.json(response);
});

app.get("/difference/:n1/:n2", (req, res) => {
    const n1 = Number(req.params.n1);
    const n2 = Number(req.params.n2);

    const result = n1 - n2;

    res.send(String(result));
});

app.get("/scream", (req, res) => {
    const result = (req.query.message + " " + req.query.recipient).toUpperCase();

    res.send(result);
});


// LAB 9 - AI RECIPE SEARCH
app.get("/ai/recipes", async function (req, res) {
    try {
        // More code will be added in Step 2.3
    } catch (err) {
        console.error("AI search error:", err);

        res.status(500).json({
            error: "Server error performing AI search"
        });
    }
});



app.listen(3000, () => {
    console.log("Server started")
})

