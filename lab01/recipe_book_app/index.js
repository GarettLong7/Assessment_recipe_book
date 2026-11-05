
const express = require("express");
const cors = require("cors");
require("dotenv").config();

const { connect } = require("./db");
const { ObjectId } = require("mongodb");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { generateSearchParams, generateRecipe } = require("./gemini");

const mongoUri = process.env.MONGO_URI;
const dbname = "recipe_book";

const app = express();

// Enable JSON request bodies
app.use(express.json());

// Enable CORS
app.use(cors());

// GENERATE JWT ACCESS TOKEN
const generateAccessToken = (id, email) => {
    return jwt.sign(
        {
            user_id: id,
            email: email
        },
        process.env.TOKEN_SECRET,
        {
            expiresIn: "1h"
        }
    );
};

// STEP 5 - VERIFY JWT TOKEN MIDDLEWARE
const verifyToken = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.sendStatus(403);
    }

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) {
            return res.sendStatus(403);
        }

        req.user = user;
        next();
    });
};

async function main() {
    try {
        const db = await connect(mongoUri, dbname);
        console.log("Connected to MongoDB");

        // HOME ROUTE
        app.get("/", (req, res) => {
            res.json({
                message: "Hello World!"
            });
        });

        // GET - SEARCH RECIPES
        app.get("/recipes", async (req, res) => {
            try {
                const { tags, cuisine, ingredients, name } = req.query;
                let query = {};

                if (tags) {
                    query["tags.name"] = {
                        $in: tags.split(",")
                    };
                }

                if (cuisine) {
                    query["cuisine.name"] = {
                        $regex: cuisine,
                        $options: "i"
                    };
                }

                if (ingredients) {
                    query["ingredients.name"] = {
                        $all: ingredients.split(",").map(
                            i => new RegExp(i, "i")
                        )
                    };
                }

                if (name) {
                    query.name = {
                        $regex: name,
                        $options: "i"
                    };
                }

                const recipes = await db.collection("recipes")
                    .find(query)
                    .project({
                        name: 1,
                        "cuisine.name": 1,
                        "tags.name": 1,
                        _id: 0
                    })
                    .toArray();

                res.json({ recipes });

            } catch (error) {
                console.error("Error searching recipes:", error);

                res.status(500).json({
                    error: "Internal server error"
                });
            }
        });

        // POST - CREATE NEW RECIPE
        app.post("/recipes", async (req, res) => {
            try {
                const {
                    name,
                    cuisine,
                    prepTime,
                    cookTime,
                    servings,
                    ingredients,
                    instructions,
                    tags
                } = req.body || {};

                if (!name || !cuisine || !ingredients ||
                    !instructions || !tags) {
                    return res.status(400).json({
                        error: "Missing required fields"
                    });
                }

                // Fetch cuisine document
                const cuisineDoc = await db.collection("cuisines")
                    .findOne({ name: cuisine });

                if (!cuisineDoc) {
                    return res.status(400).json({
                        error: "Invalid cuisine"
                    });
                }

                // Fetch tag documents
                const tagDocs = await db.collection("tags")
                    .find({
                        name: { $in: tags }
                    })
                    .toArray();

                if (tagDocs.length !== tags.length) {
                    return res.status(400).json({
                        error: "One or more invalid tags"
                    });
                }

                // Create new recipe
                const newRecipe = {
                    name,
                    cuisine: {
                        _id: cuisineDoc._id,
                        name: cuisineDoc.name
                    },
                    prepTime,
                    cookTime,
                    servings,
                    ingredients,
                    instructions,
                    tags: tagDocs.map(tag => ({
                        _id: tag._id,
                        name: tag.name
                    }))
                };

                // Insert recipe
                const result = await db.collection("recipes")
                    .insertOne(newRecipe);

                res.status(201).json({
                    message: "Recipe created successfully",
                    recipeId: result.insertedId
                });

            } catch (error) {
                console.error("Error creating recipe:", error);

                res.status(500).json({
                    error: "Internal server error"
                });
            }
        });

        // POST - REGISTER NEW USER
        app.post("/users", async (req, res) => {
            try {
                const { email, password } = req.body || {};

                if (!email || !password ||
                    typeof email !== "string" ||
                    typeof password !== "string") {
                    return res.status(400).json({
                        error: "Valid email and password are required"
                    });
                }

                // Check whether email already exists
                const existingUser = await db.collection("users")
                    .findOne({ email });

                if (existingUser) {
                    return res.status(409).json({
                        error: "Email already registered"
                    });
                }

                // Hash password
                const hashedPassword = await bcrypt.hash(password, 12);

                // Insert user
                const result = await db.collection("users")
                    .insertOne({
                        email: email,
                        password: hashedPassword
                    });

                res.status(201).json({
                    message: "New user account",
                    result: result
                });

            } catch (error) {
                console.error("Error creating user:", error);

                res.status(500).json({
                    error: "Internal server error"
                });
            }
        });

        // POST - LOGIN USER
        app.post("/login", async (req, res) => {
            try {
                const { email, password } = req.body || {};

                if (!email || !password) {
                    return res.status(400).json({
                        message: "Email and password are required"
                    });
                }

                // Find user by email
                const user = await db.collection("users")
                    .findOne({ email: email });

                if (!user) {
                    return res.status(401).json({
                        message: "Invalid email or password"
                    });
                }

                // Compare password with stored hash
                const isPasswordValid = await bcrypt.compare(
                    password,
                    user.password
                );

                if (!isPasswordValid) {
                    return res.status(401).json({
                        message: "Invalid email or password"
                    });
                }

                // Generate JWT
                const accessToken = generateAccessToken(
                    user._id,
                    user.email
                );

                res.json({
                    accessToken: accessToken
                });

            } catch (error) {
                console.error("Error logging in:", error);

                res.status(500).json({
                    error: "Internal server error"
                });
            }
        });

        // STEP 5 - EXAMPLE PROTECTED ROUTE
        app.get("/protected-route", verifyToken, (req, res) => {
            res.json({
                message: "You accessed a protected route!",
                user: req.user
            });
        });

        // STEP 6 - PROTECTED PROFILE ROUTE
        app.get("/profile", verifyToken, (req, res) => {
            res.json({
                message: "This is a protected route",
                user: req.user
            });
        });

        // PUT - UPDATE EXISTING RECIPE
        app.put("/recipes/:id", async (req, res) => {
            try {
                const recipeId = req.params.id;

                if (!ObjectId.isValid(recipeId)) {
                    return res.status(400).json({
                        error: "Invalid recipe ID"
                    });
                }

                const {
                    name,
                    cuisine,
                    prepTime,
                    cookTime,
                    servings,
                    ingredients,
                    instructions,
                    tags
                } = req.body || {};

                if (!name || !cuisine || !ingredients ||
                    !instructions || !tags) {
                    return res.status(400).json({
                        error: "Missing required fields"
                    });
                }

                const cuisineDoc = await db.collection("cuisines")
                    .findOne({ name: cuisine });

                if (!cuisineDoc) {
                    return res.status(400).json({
                        error: "Invalid cuisine"
                    });
                }

                const tagDocs = await db.collection("tags")
                    .find({
                        name: { $in: tags }
                    })
                    .toArray();

                if (tagDocs.length !== tags.length) {
                    return res.status(400).json({
                        error: "One or more invalid tags"
                    });
                }

                const updatedRecipe = {
                    name,
                    cuisine: {
                        _id: cuisineDoc._id,
                        name: cuisineDoc.name
                    },
                    prepTime,
                    cookTime,
                    servings,
                    ingredients,
                    instructions,
                    tags: tagDocs.map(tag => ({
                        _id: tag._id,
                        name: tag.name
                    }))
                };

                // Preserve existing reviews
                const result = await db.collection("recipes")
                    .updateOne(
                        { _id: new ObjectId(recipeId) },
                        { $set: updatedRecipe }
                    );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        error: "Recipe not found"
                    });
                }

                res.json({
                    message: "Recipe updated successfully"
                });

            } catch (error) {
                console.error("Error updating recipe:", error);

                res.status(500).json({
                    error: "Internal server error"
                });
            }
        });

        // POST - ADD A REVIEW TO A RECIPE
        app.post("/recipes/:id/reviews", async (req, res) => {
            try {
                const recipeId = req.params.id;
                const { user, rating, comment } = req.body || {};

                if (!ObjectId.isValid(recipeId)) {
                    return res.status(400).json({
                        error: "Invalid recipe ID"
                    });
                }

                if (!user || !rating || !comment) {
                    return res.status(400).json({
                        error: "Missing required fields"
                    });
                }

                const newReview = {
                    review_id: new ObjectId(),
                    user,
                    rating: Number(rating),
                    comment,
                    date: new Date()
                };

                const result = await db.collection("recipes")
                    .updateOne(
                        { _id: new ObjectId(recipeId) },
                        { $push: { reviews: newReview } }
                    );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        error: "Recipe not found"
                    });
                }

                res.status(201).json({
                    message: "Review added successfully",
                    reviewId: newReview.review_id
                });

            } catch (error) {
                console.error("Error adding review:", error);

                res.status(500).json({
                    error: "Internal server error"
                });
            }
        });

        // PUT - UPDATE A SPECIFIC REVIEW
        app.put("/recipes/:recipeId/reviews/:reviewId", async (req, res) => {
            try {
                const recipeId = req.params.recipeId;
                const reviewId = req.params.reviewId;
                const { user, rating, comment } = req.body || {};

                if (!ObjectId.isValid(recipeId) ||
                    !ObjectId.isValid(reviewId)) {
                    return res.status(400).json({
                        error: "Invalid recipe or review ID"
                    });
                }

                if (!user || !rating || !comment) {
                    return res.status(400).json({
                        error: "Missing required fields"
                    });
                }

                const updatedReview = {
                    review_id: new ObjectId(reviewId),
                    user,
                    rating: Number(rating),
                    comment,
                    date: new Date()
                };

                const result = await db.collection("recipes")
                    .updateOne(
                        {
                            _id: new ObjectId(recipeId),
                            "reviews.review_id": new ObjectId(reviewId)
                        },
                        {
                            $set: {
                                "reviews.$": updatedReview
                            }
                        }
                    );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        error: "Recipe or review not found"
                    });
                }

                res.json({
                    message: "Review updated successfully",
                    reviewId: reviewId
                });

            } catch (error) {
                console.error("Error updating review:", error);

                res.status(500).json({
                    error: "Internal server error"
                });
            }
        });

        // DELETE - REMOVE A SPECIFIC REVIEW
        app.delete("/recipes/:recipeId/reviews/:reviewId", async (req, res) => {
            try {
                const recipeId = req.params.recipeId;
                const reviewId = req.params.reviewId;

                if (!ObjectId.isValid(recipeId) ||
                    !ObjectId.isValid(reviewId)) {
                    return res.status(400).json({
                        error: "Invalid recipe or review ID"
                    });
                }

                const result = await db.collection("recipes")
                    .updateOne(
                        {
                            _id: new ObjectId(recipeId)
                        },
                        {
                            $pull: {
                                reviews: {
                                    review_id: new ObjectId(reviewId)
                                }
                            }
                        }
                    );

                if (result.matchedCount === 0) {
                    return res.status(404).json({
                        error: "Recipe not found"
                    });
                }

                if (result.modifiedCount === 0) {
                    return res.status(404).json({
                        error: "Review not found"
                    });
                }

                res.json({
                    message: "Review deleted successfully"
                });

            } catch (error) {
                console.error("Error deleting review:", error);

                res.status(500).json({
                    error: "Internal server error"
                });
            }
        });


        // LAB 9 - AI RECIPE SEARCH
        app.get("/ai/recipes", async function (req, res) {
            try {
                const query = req.query.q;

                if (!query || !query.trim()) {
                    return res.status(400).json({
                        error: "Please provide a search query"
                    });
                }

                // Get available values from MongoDB
                const allCuisines = await db.collection("cuisines")
                    .distinct("name");

                const allTags = await db.collection("tags")
                    .distinct("name");

                const allIngredients = await db.collection("recipes")
                    .distinct("ingredients.name");

                // Ask Gemini to interpret the user's query
                const searchParams = await generateSearchParams(
                    query,
                    allTags,
                    allCuisines,
                    allIngredients
                );

                // Build MongoDB search criteria
                const criteria = {};

                if (searchParams.cuisines?.length > 0) {
                    criteria["cuisine.name"] = {
                        $in: searchParams.cuisines
                    };
                }

                if (searchParams.ingredients?.length > 0) {
                    criteria["ingredients.name"] = {
                        $all: searchParams.ingredients
                    };
                }

                if (searchParams.tags?.length > 0) {
                    criteria["tags.name"] = {
                        $in: searchParams.tags
                    };
                }

                // Search MongoDB
                const recipes = await db.collection("recipes")
                    .find(criteria)
                    .toArray();

                res.json({ recipes });

            } catch (err) {
                console.error("AI search error:", err);

                res.status(500).json({
                    error: "Server error performing AI search"
                });
            }
        });


        app.post("/ai/recipes", async function (req, res) {
            try {
                const recipeText = req.body.prompt;

                if (!recipeText || typeof recipeText !== "string" || !recipeText.trim()) {
                    return res.status(400).json({
                        error: "Please provide a recipe description"
                    });
                }

                const availableCuisines = await db.collection("cuisines").distinct("name");
                const availableTags = await db.collection("tags").distinct("name");

                const recipe = await generateRecipe(
                    recipeText,
                    availableCuisines,
                    availableTags
                );


                const cuisineDoc = await db.collection("cuisines")
                    .findOne({ name: recipe.cuisine });

                if (!cuisineDoc) {
                    return res.status(400).json({
                        error: "AI generated an invalid cuisine"
                    });
                }

                const tagDocs = await db.collection("tags")
                    .find({ name: { $in: recipe.tags } })
                    .toArray();

                if (tagDocs.length !== new Set(recipe.tags).size) {
                    return res.status(400).json({
                        error: "AI generated one or more invalid tags"
                    });
                }

                recipe.cuisine = {
                    _id: cuisineDoc._id,
                    name: cuisineDoc.name
                };

                recipe.tags = tagDocs.map(tag => ({
                    _id: tag._id,
                    name: tag.name
                }));

                const result = await db.collection("recipes").insertOne(recipe);


                res.status(201).json({
                    message: "AI recipe generated successfully",
                    recipe: {
                        ...recipe,
                        _id: result.insertedId
                    }
                });

            } catch (err) {
                console.error("AI recipe generation error:", err);

                res.status(500).json({
                    error: "Server error generating AI recipe"
                });
            }
        });

        // START SERVER
        app.listen(3000, () => {
            console.log("Server has started");
        });

    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
    }
}

main();
