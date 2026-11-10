# Recipe Book API

## Target Users
Home cooks who want to store recipes and find meals using
ingredients, cuisines and tags.

## Problem
Searching through saved recipes manually can be time-consuming.

## Solution
This API lets users create, search, update and delete recipes.
It also supports natural-language recipe searches and AI recipe
generation using Gemini.

## Technologies
- Node.js and Express
- MongoDB
- Gemini API
- bcrypt for password hashing
- JSON Web Tokens for authentication

## API Endpoints

| Method | Endpoint | Purpose | JWT required |
|---|---|---|---|
| GET | /recipes | List recipes or search using query parameters | No |
| POST | /recipes | Create a recipe | No |
| PUT | /recipes/:id | Update a recipe | No |
| DELETE | /recipes/:id | Delete a recipe | No |
| POST | /users | Register a user | No |
| POST | /login | Log in and receive a JWT | No |
| GET | /profile | View authenticated user details | Yes |
| GET | /ai/recipes?q=... | Search recipes using natural language | No |
| POST | /ai/recipes | Generate and save an AI recipe | No |

### Search Parameters

GET /recipes supports:
- name
- cuisine
- ingredients — comma-separated
- tags — comma-separated

### Authentication

For protected routes, send this header:

Authorization: Bearer YOUR_ACCESS_TOKEN

## Local Setup

1. Open the `recipe_book_app` folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env` file in that folder:

   ```env
   MONGO_URI=your_mongodb_connection_string
   TOKEN_SECRET=your_jwt_signing_secret
   GEMINI_API_KEY=your_gemini_api_key
   GEMINI_MODEL=your_supported_gemini_model
   ```

4. Prepare the `recipe_book` database with the `recipes`,
   `cuisines`, `tags` and `users` collections. Import your
   seed data before testing.

5. Start the server:

   ```bash
   node index.js
   ```

6. Access the API at `http://localhost:3000`.

Keep `.env` out of GitHub. The values above are placeholders;
replace them with your own configuration.

## Database Design

Database name: recipe_book

| Collection | Purpose | Main attributes |
|---|---|---|
| recipes | Store recipes | name, cuisine, prepTime, cookTime, servings, ingredients, instructions, tags, reviews |
| cuisines | Store available cuisines | _id, name |
| tags | Store available recipe tags | _id, name |
| users | Store registered accounts | _id, email, password (hashed) |

### Relationships

Each recipe embeds a cuisine object and an array of tag objects.
These contain the IDs and names of documents from the cuisines
and tags collections.

Recipes also support embedded reviews.

### AI Features

Gemini converts natural-language searches into structured JSON,
which Express uses to build MongoDB queries.

Gemini can also generate structured recipe data that the API
saves to MongoDB.

## Deployed API

Base URL:
https://recipe-book-api-t54p.onrender.com

Example:
GET https://recipe-book-api-t54p.onrender.com/recipes