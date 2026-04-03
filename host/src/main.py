#!/usr/bin/env python3
import sys
import ssl
import socket
import json
import struct
from cryptography import x509
from cryptography.hazmat.backends import default_backend

from urllib.parse import urlparse


def receive_message() -> dict:
    raw_length = sys.stdin.buffer.read(4)
    if not raw_length:
        return None
    message_length = struct.unpack('@I', raw_length)[0]
    message_bytes = sys.stdin.buffer.read(message_length)
    if not message_bytes:
        return None
    return json.loads(message_bytes.decode('utf-8'))


def get_certificate(url: str) -> dict:
    parsed_url = urlparse(url)
    hostname = parsed_url.hostname
    port = parsed_url.port or 443
    
    context = ssl.create_default_context()
    with socket.create_connection((hostname, port), timeout=3) as sock:
        with context.wrap_socket(sock, server_hostname=hostname) as ssock:
            der_certificate = ssock.getpeercert(binary_form=True)
            raw_certificate = x509.load_der_x509_certificate(der_certificate, default_backend())
            
            cipher_info = ssock.cipher()
            protocol = cipher_info[1]
            cipher = cipher_info[0]

            subject_name = raw_certificate.subject.rfc4514_string()
            issuer = raw_certificate.issuer.rfc4514_string()

            valid_from = raw_certificate.not_valid_before_utc
            valid_to = raw_certificate.not_valid_after_utc

            san_list = []
            try:
                san_ext = raw_certificate.extensions.get_extension_for_class(x509.SubjectAlternativeName)
                san_list = san_ext.value.get_values_for_type(x509.DNSName)
            except x509.ExtensionNotFound:
                pass

            signature_algorithm = raw_certificate.signature_algorithm_oid._name

            certificate = {
                "protocol": protocol,
                "cipher": cipher,
                "subjectName": subject_name,
                "issuer": issuer,
                "validFrom": valid_from.isoformat(),
                "validTo": valid_to.isoformat(),
                "sanList": san_list,
                "signatureAlgorithm": signature_algorithm
            }

            return certificate


def handle_message(message: dict) -> dict:
    action = message.get("action")
    
    if action == "get_certificate":
        url = message.get("url")
        timestamp = message.get("timestamp")

        certificate = get_certificate(url)

        return {
            "status": "success",
            "url": url,
            "timestamp": timestamp,
            "certificate": certificate
        }

    return {
        "status": "error", 
        "message": "Unknown action: {}".format(action)
    }


def send_response(response: dict) -> None:
    encoded_response = json.dumps(response).encode('utf-8')
    encoded_length = struct.pack('@I', len(encoded_response))
    sys.stdout.buffer.write(encoded_length)
    sys.stdout.buffer.write(encoded_response)
    sys.stdout.flush()


def main():
    while True:
        message = receive_message()
        if message is None:
            break
        try:
            response = handle_message(message)
        except Exception as error:
            response = {
                "status": "error",
                "message": str(error)
            }
        send_response(response)


if __name__ == "__main__":
    main()