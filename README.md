# FOODFLOW — Smart Food Delivery Management System

A college prototype with a cinematic landing page and mock-data dashboards. **Firebase and external databases have been removed.**

## Stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Python + Flask
- Data: in-memory mock dataset (resets whenever the Flask process restarts)
- Visuals: existing scroll-driven landing animation, Three.js and Anime.js CDN scripts retained for the original experience

## Run locally
1. Install Python 3.10+
2. Open a terminal in `foodflow/backend`
3. `python -m venv .venv`
4. Activate the virtual environment
5. `pip install -r requirements.txt`
6. `python app.py`
7. Open `http://localhost:5000` if using the Flask static serving setup, or serve `frontend` separately and set `FF_API_BASE` to `http://localhost:5000`.

## Demo accounts
All demo passwords are `demo123`.
- Customer: `customer@foodflow.demo`
- Restaurant: `restaurant@foodflow.demo`
- Delivery partner: `delivery@foodflow.demo`
- Admin: `admin@foodflow.demo`

Registering a new account creates a browser-local mock user. No real authentication is performed.

## Mock dataset
The Flask process seeds three restaurants, menu items, inventory, three delivery partners, demo users, and sample orders automatically. API changes are in-memory and reset on server restart.

## Notes
- This is a demonstration/prototype only. Do not use it for real customer data, payments, or production authentication.
- The landing page HTML, CSS, scroll-frame assets, and visual structure are preserved.
