from flask import Flask, jsonify, request
import json

app = Flask(__name__)

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"

@app.route("/api/certificate", methods=["POST"])
def get_certificate():
    data = request.get_json(silent=True)
    print(f"Received from Browser: {json.dumps(data, indent=4)}")
    url = data.get("url")
    timestamp = data.get("timestamp")
    certificate = data.get("certificate")
    response = {
        "status": "success",
        "url": url,
        "timestamp": timestamp,
        "certificate": certificate
    }
    return jsonify(response)