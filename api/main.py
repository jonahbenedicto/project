from flask import Flask
import os
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, jwt_required, get_jwt_identity, create_access_token
from sqlalchemy.dialects.postgresql import ARRAY as Array
from datetime import datetime, timezone, timedelta
import enum
from flask_smorest import Api, Blueprint, abort
from marshmallow import Schema, fields, validate
from werkzeug.security import generate_password_hash, check_password_hash
from flask_cors import CORS
import hashlib
import secrets
 
app = Flask(__name__)
CORS(app)
 
db_url = os.environ.get("DATABASE_URL", "postgresql://devuser:devpassword@localhost:5432/devdatabase")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
 
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "super-secret-local-key")
app.config["API_TITLE"] = "API"
app.config["API_VERSION"] = "v1"
app.config["OPENAPI_VERSION"] = "3.0.3"
app.config["OPENAPI_URL_PREFIX"] = "/api"
app.config["OPENAPI_SWAGGER_UI_PATH"] = "/docs/swagger"
app.config["OPENAPI_SWAGGER_UI_URL"] = "https://cdn.jsdelivr.net/npm/swagger-ui-dist/"
app.config["OPENAPI_REDOC_PATH"] = "/docs/redoc"
app.config["OPENAPI_REDOC_URL"] = "https://cdn.jsdelivr.net/npm/redoc/bundles/redoc.standalone.js"
app.config["OPENAPI_RAPIDOC_PATH"] = "/docs/rapidoc"
app.config["OPENAPI_RAPIDOC_URL"] = "https://unpkg.com/rapidoc/dist/rapidoc-min.js"
app.config["API_SPEC_OPTIONS"] = {
    "info": {
        "description": "Api",
    },
    "components": {
        "securitySchemes": {
            "bearerAuth": {
                "type": "http",
                "scheme": "bearer",
                "bearerFormat": "JWT",
            }
        }
    },
    "tags": [
        {"name": "authentication", "description": "Authentication."},
        {"name": "user",           "description": "User."},
        {"name": "organisation",   "description": "Organisation."},
        {"name": "invite",         "description": "Invite."},
        {"name": "consent",        "description": "Consent."},
        {"name": "policy",         "description": "Policy."},
        {"name": "certificate",    "description": "Certificate."},
        {"name": "compliance",     "description": "Compliance."},
    ],
}
 
db = SQLAlchemy(app)
jwt = JWTManager(app)
api = Api(app)
 
@app.route("/api/docs/scalar")
def scalar_docs():
    return """
    <!doctype html>
    <html>
      <head>
        <title>API Documentation</title>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <script
          id="api-reference"
          data-url="/api/openapi.json"></script>
        <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
      </body>
    </html>
    """
 
 
# Enums
 
class RoleName(enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
 
 
# Models
 
class User(db.Model):
    __tablename__ = "users"
 
    user_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, nullable=False)
    username = db.Column(db.Text, unique=True, nullable=False)
    email = db.Column(db.Text, unique=True, nullable=False)
    password_hash = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
 
    membership = db.relationship("Membership", uselist=False)
    certificates = db.relationship("Certificate")
    consents = db.relationship("Consent")
 
 
class Consent(db.Model):
    __tablename__ = "consents"
    __table_args__ = (db.UniqueConstraint("user_id", "policy_id", name="unique_user_policy_consent"),)
 
    consent_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    policy_id = db.Column(db.Integer, db.ForeignKey('policies.policy_id'), nullable=False)
    has_consent = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    revoked_at = db.Column(db.DateTime, nullable=True, default=None)
 
    policy = db.relationship("Policy")
 
 
class Organisation(db.Model):
    __tablename__ = "organisations"
 
    organisation_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, unique=True, nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    active_policy_id = db.Column(db.Integer, db.ForeignKey("policies.policy_id", use_alter=True), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
 
    policies = db.relationship("Policy", foreign_keys="Policy.organisation_id")
    active_policy = db.relationship("Policy", foreign_keys=[active_policy_id], uselist=False)
    invites = db.relationship("Invite")
 
 
class Invite(db.Model):
    __tablename__ = "invites"
 
    invite_id = db.Column(db.Integer, primary_key=True)
    token_hash = db.Column(db.Text, unique=True, nullable=False)
    organisation_id = db.Column(db.Integer, db.ForeignKey("organisations.organisation_id"), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.role_id"), nullable=False)
    expires_at = db.Column(db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc) + timedelta(minutes=2))
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
    usage_count = db.Column(db.Integer, nullable=False, default=0)
    max_usage = db.Column(db.Integer, nullable=False, default=1)
 
    role = db.relationship("Role")
    organisation = db.relationship("Organisation")
 
 
class Role(db.Model):
    __tablename__ = "roles"
 
    role_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Enum(RoleName), unique=True, nullable=False)
 
 
class Membership(db.Model):
    __tablename__ = "memberships"
    __table_args__ = (db.UniqueConstraint("user_id", name="unique_user"),)
 
    organisation_id = db.Column(db.Integer, db.ForeignKey("organisations.organisation_id"), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey("roles.role_id"), nullable=False)
    joined_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
 
    organisation = db.relationship("Organisation")
    role = db.relationship("Role")
 
 
class Certificate(db.Model):
    __tablename__ = "certificates"
 
    certificate_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.user_id"), nullable=False)
    recent_compliance_id = db.Column(db.Integer, db.ForeignKey("compliance.compliance_id", use_alter=True), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
 
    compliances = db.relationship("Compliance", foreign_keys="Compliance.certificate_id")
    recent_compliance = db.relationship("Compliance", foreign_keys=[recent_compliance_id], uselist=False)
 
    protocol = db.Column(db.Text, nullable=False)
    key_exchange = db.Column(db.Text, nullable=False)
    key_exchange_group = db.Column(db.Text, nullable=False)
    cipher = db.Column(db.Text, nullable=False)
    mac = db.Column(db.Text, nullable=False)
    subject_name = db.Column(db.Text, nullable=False)
    san_list = db.Column(Array(db.Text), nullable=False)
    issuer = db.Column(db.Text, nullable=False)
    valid_from = db.Column(db.DateTime(timezone=True), nullable=False)
    valid_to = db.Column(db.DateTime(timezone=True), nullable=False)
    signed_certificate_timestamp_list = db.Column(db.Boolean, nullable=False)
    certificate_transparency_compliance = db.Column(db.Boolean, nullable=False)
    encrypted_client_hello = db.Column(db.Boolean, nullable=False)
 
 
class Compliance(db.Model):
    __tablename__ = "compliance"
 
    compliance_id = db.Column(db.Integer, primary_key=True)
    certificate_id = db.Column(db.Integer, db.ForeignKey("certificates.certificate_id"), nullable=False)
    policy_id = db.Column(db.Integer, db.ForeignKey("policies.policy_id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
 
    policy = db.relationship("Policy")
    
    has_valid_protocol = db.Column(db.Boolean, nullable=False)
    has_valid_key_exchange = db.Column(db.Boolean, nullable=False)
    has_valid_key_exchange_group = db.Column(db.Boolean, nullable=False)
    has_valid_cipher = db.Column(db.Boolean, nullable=False)
    has_valid_mac = db.Column(db.Boolean, nullable=False)
    has_valid_domain = db.Column(db.Boolean, nullable=False)
    has_valid_issuer = db.Column(db.Boolean, nullable=False)
    has_valid_days_until_expiration = db.Column(db.Boolean, nullable=False)
    has_valid_days_since_issuance = db.Column(db.Boolean, nullable=False)
    has_valid_signed_certificate_timestamp_list = db.Column(db.Boolean, nullable=False)
    has_valid_certificate_transparency_compliance = db.Column(db.Boolean, nullable=False)
    has_valid_encrypted_client_hello = db.Column(db.Boolean, nullable=False)
 
 
class Policy(db.Model):
    __tablename__ = "policies"
 
    policy_id = db.Column(db.Integer, primary_key=True)
    organisation_id = db.Column(db.Integer, db.ForeignKey("organisations.organisation_id"), nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))
 
    valid_protocols = db.Column(Array(db.Text), nullable=False)
    valid_key_exchanges = db.Column(Array(db.Text), nullable=False)
    valid_key_exchange_groups = db.Column(Array(db.Text), nullable=False)
    valid_ciphers = db.Column(Array(db.Text), nullable=False)
    valid_macs = db.Column(Array(db.Text), nullable=False)
    valid_domains = db.Column(Array(db.Text), nullable=False)
    valid_issuers = db.Column(Array(db.Text), nullable=False)
    min_days_until_expiration = db.Column(db.Integer, nullable=False)
    max_days_since_issuance = db.Column(db.Integer, nullable=False)
    require_signed_certificate_timestamp_list = db.Column(db.Boolean, nullable=False)
    require_certificate_transparency_compliance = db.Column(db.Boolean, nullable=False)
    require_encrypted_client_hello = db.Column(db.Boolean, nullable=False)
 
 
# Blueprints
 
authentication_blp = Blueprint(
    "authentication",
    __name__,
    url_prefix="/api/authentication",
    description="Authentication",
)
 
user_blp = Blueprint(
    "user",
    __name__,
    url_prefix="/api/user",
    description="User",
)
 
consent_blp = Blueprint(
    "consent",
    __name__,
    url_prefix="/api/consent",
    description="Consent",
)
 
organisation_blp = Blueprint(
    "organisation",
    __name__,
    url_prefix="/api/organisation",
    description="Organisation",
)
 
invite_blp = Blueprint(
    "invite",
    __name__,
    url_prefix="/api/invite",
    description="Invite",
)
 
policy_blp = Blueprint(
    "policy",
    __name__,
    url_prefix="/api/policy",
    description="Policy",
)
 
certificate_blp = Blueprint(
    "certificate",
    __name__,
    url_prefix="/api/certificate",
    description="Certificate",
)
 
compliance_blp = Blueprint(
    "compliance",
    __name__,
    url_prefix="/api/compliance",
    description="Compliance",
)
 
 
# Schemas
 
# --- Authentication ---
 
class SignUpRequestSchema(Schema):
    class Meta:
        example = {
            "name": "Jonah Benedicto",
            "username": "jonahbenedicto",
            "email": "jonahbenedicto@example.com",
            "password": "jonahbenedicto123",
        }
    name = fields.String(required=True, metadata={"description": "Name"})
    username = fields.String(required=True, metadata={"description": "Username"})
    email = fields.Email(required=True, metadata={"description": "Email"})
    password = fields.String(required=True, load_only=True, metadata={"description": "Password"})
 
class SignInRequestSchema(Schema):
    class Meta:
        example = {
            "username": "jonahbenedicto", 
            "password": "jonahbenedicto123"
        }
    username = fields.String(required=True, metadata={"description": "Username"})
    password = fields.String(required=True, load_only=True, metadata={"description": "Password"})
 
class AccessTokenResponseSchema(Schema):
    class Meta:
        example = {"access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}
    access_token = fields.String(dump_only=True, metadata={"description": "JWT Bearer token"})
 
 
# --- User ---
 
class UserResponseSchema(Schema):
    class Meta:
        example = {
            "user_id": 1,
            "name": "Jonah Benedicto",
            "username": "jonahbenedicto",
            "email": "jonahbenedicto@example.com",
            "created_at": "2024-01-15T10:30:00",
        }
    user_id = fields.Int(dump_only=True, metadata={"description": "User ID"})
    name = fields.String(dump_only=True, metadata={"description": "Name"})
    username = fields.String(dump_only=True, metadata={"description": "Username"})
    email = fields.Email(dump_only=True, metadata={"description": "Email"})
    created_at = fields.DateTime(dump_only=True, metadata={"description": "Created at"})
 
 
# --- Organisation ---
 
class CreateOrganisationRequestSchema(Schema):
    class Meta:
        example = {
            "name": "Jonah Benedicto Organisation"
        }
    name = fields.String(required=True, metadata={"description": "Organisation name"})
 
class OrganisationResponseSchema(Schema):
    class Meta:
        example = {
            "organisation_id": 1,
            "name": "Jonah Benedicto Organisation",
            "owner_id": 1,
            "active_policy_id": 3,
            "created_at": "2024-01-15T10:30:00",
        }
    organisation_id  = fields.Int(dump_only=True, metadata={"description": "Organisation ID"})
    name = fields.String(dump_only=True, metadata={"description": "Organisation name"})
    owner_id = fields.Int(dump_only=True, metadata={"description": "Owner ID"})
    active_policy_id = fields.Int(dump_only=True, allow_none=True, metadata={"description": "Active policy ID"})
    created_at = fields.DateTime(dump_only=True, metadata={"description": "Created at"})

class MembershipRoleResponseSchema(Schema):
    class Meta:
        example = {"role": "admin"}
    role = fields.String(dump_only=True, metadata={"description": "Role name"})


# --- Invite ---
 
class CreateInviteRequestSchema(Schema):
    class Meta:
        example = {
            "role": "member", 
            "max_usage": 5
        }
    role = fields.String(required=True, validate=validate.OneOf([r.value for r in RoleName]), metadata={"description": "Role"})
    max_usage = fields.Int(load_default=1, metadata={"description": "Max usage"})
 
class InviteResponseSchema(Schema):
    class Meta:
        example = {
            "invite_id": 10,
            "invite_code": "a1b2c3d4e5f6",
            "role": "member",
            "expires_at": "2024-01-15T10:32:00",
            "usage_count": 0,
            "max_usage": 5,
            "created_at": "2024-01-15T10:30:00",
        }
    invite_id = fields.Int(dump_only=True, metadata={"description": "Invite ID"})
    invite_code = fields.String(dump_only=True, metadata={"description": "Invite code"})
    role = fields.String(dump_only=True, metadata={"description": "Role"})
    expires_at = fields.DateTime(dump_only=True, metadata={"description": "Expires at"})
    usage_count = fields.Int(dump_only=True, metadata={"description": "Usage count"})
    max_usage = fields.Int(dump_only=True, metadata={"description": "Max usage"})
    created_at = fields.DateTime(dump_only=True, metadata={"description": "Created at"})
 
 
# --- Consent ---
 
class ConsentResponseSchema(Schema):
    class Meta:
        example = {
            "consent_id": 7,
            "user_id": 1,
            "policy_id": 3,
            "has_consent": True,
            "created_at": "2024-01-15T10:30:00",
            "revoked_at": None,
        }
    consent_id = fields.Int(dump_only=True, metadata={"description": "Consent ID"})
    user_id = fields.Int(dump_only=True, metadata={"description": "User ID"})
    policy_id = fields.Int(dump_only=True, metadata={"description": "Policy ID"})
    has_consent = fields.Boolean(dump_only=True, metadata={"description": "Has consent"})
    created_at = fields.DateTime(dump_only=True, metadata={"description": "Created at"})
    revoked_at = fields.DateTime(dump_only=True, allow_none=True, metadata={"description": "Revoked at"})
 
 
# --- Policy ---
 
class CreatePolicyRequestSchema(Schema):
    class Meta:
        example = {
            "valid_protocols": ["TLSv1.2", "TLSv1.3"],
            "valid_key_exchanges": ["ECDH"],
            "valid_key_exchange_groups": ["P-256", "X25519"],
            "valid_ciphers": ["AES_128_GCM", "AES_256_GCM"],
            "valid_macs": ["AEAD"],
            "valid_domains": ["example.com"],
            "valid_issuers": ["Let's Encrypt"],
            "min_days_until_expiration": 30,
            "max_days_since_issuance": 365,
            "require_signed_certificate_timestamp_list": True,
            "require_certificate_transparency_compliance": True,
            "require_encrypted_client_hello": False,
        }
    valid_protocols = fields.List(fields.String(), required=True, metadata={"description": "Valid protocols"})
    valid_key_exchanges = fields.List(fields.String(), required=True, metadata={"description": "Valid key exchanges"})
    valid_key_exchange_groups = fields.List(fields.String(), required=True, metadata={"description": "Valid key exchange groups"})
    valid_ciphers = fields.List(fields.String(), required=True, metadata={"description": "Valid cipher suites"})
    valid_macs = fields.List(fields.String(), required=True, metadata={"description": "Valid MAC algorithms"})
    valid_domains = fields.List(fields.String(), required=True, metadata={"description": "Valid domains"})
    valid_issuers = fields.List(fields.String(), required=True, metadata={"description": "Valid issuers"})
    min_days_until_expiration = fields.Int(required=True, metadata={"description": "Min days until expiration"})
    max_days_since_issuance = fields.Int(required=True, metadata={"description": "Max days since issuance"})
    require_signed_certificate_timestamp_list = fields.Boolean(required=True, metadata={"description": "Require signed certificate timestamp list"})
    require_certificate_transparency_compliance = fields.Boolean(required=True, metadata={"description": "Require certificate transparency compliance"})
    require_encrypted_client_hello = fields.Boolean(required=True, metadata={"description": "Require encrypted client hello"})
 
class PolicyResponseSchema(Schema):
    class Meta:
        example = {
            "policy_id": 3,
            "organisation_id": 1,
            "created_at": "2024-01-15T10:30:00",
            "valid_protocols": ["TLSv1.2", "TLSv1.3"],
            "valid_key_exchanges": ["ECDH"],
            "valid_key_exchange_groups": ["P-256", "X25519"],
            "valid_ciphers": ["AES_128_GCM", "AES_256_GCM"],
            "valid_macs": ["AEAD"],
            "valid_domains": ["example.com"],
            "valid_issuers": ["Let's Encrypt"],
            "min_days_until_expiration": 30,
            "max_days_since_issuance": 365,
            "require_signed_certificate_timestamp_list": True,
            "require_certificate_transparency_compliance": True,
            "require_encrypted_client_hello": False,
        }
    policy_id = fields.Int(dump_only=True, metadata={"description": "Policy ID"})
    organisation_id = fields.Int(dump_only=True, metadata={"description": "Organisation ID"})
    created_at = fields.DateTime(dump_only=True, metadata={"description": "Created at"})
    valid_protocols = fields.List(fields.String(), dump_only=True, metadata={"description": "Valid protocols"})
    valid_key_exchanges = fields.List(fields.String(), dump_only=True, metadata={"description": "Valid key exchanges"})
    valid_key_exchange_groups = fields.List(fields.String(), dump_only=True, metadata={"description": "Valid key exchange groups"})
    valid_ciphers = fields.List(fields.String(), dump_only=True, metadata={"description": "Valid cipher suites"})
    valid_macs = fields.List(fields.String(), dump_only=True, metadata={"description": "Valid macs"})
    valid_domains = fields.List(fields.String(), dump_only=True, metadata={"description": "Valid domains"})
    valid_issuers = fields.List(fields.String(), dump_only=True, metadata={"description": "Valid issuers"})
    min_days_until_expiration = fields.Int(dump_only=True, metadata={"description": "Min days until expiration"})
    max_days_since_issuance = fields.Int(dump_only=True, metadata={"description": "Max days since issuance"})
    require_signed_certificate_timestamp_list = fields.Boolean(dump_only=True, metadata={"description": "Require signed certificate timestamp list"})
    require_certificate_transparency_compliance = fields.Boolean(dump_only=True, metadata={"description": "Require certificate transparency compliance"})
    require_encrypted_client_hello = fields.Boolean(dump_only=True, metadata={"description": "Require encrypted client hello"})
 
 
# --- Certificate ---
 
class CreateCertificateRequestSchema(Schema):
    class Meta:
        example = {
            "protocol": "TLSv1.3",
            "key_exchange": "ECDH",
            "key_exchange_group": "X25519",
            "cipher": "AES_128_GCM",
            "mac": "AEAD",
            "subject_name": "example.com",
            "san_list": ["example.com", "www.example.com"],
            "issuer": "Let's Encrypt",
            "valid_from": "2024-01-01T00:00:00",
            "valid_to": "2025-01-01T00:00:00",
            "signed_certificate_timestamp_list": True,
            "certificate_transparency_compliance": True,
            "encrypted_client_hello": False,
        }
    protocol = fields.String(required=True, metadata={"description": "Protocol"})
    key_exchange = fields.String(required=True, metadata={"description": "Key exchange"})
    key_exchange_group = fields.String(required=True, metadata={"description": "Key exchange group"})
    cipher = fields.String(required=True, metadata={"description": "Cipher"})
    mac = fields.String(required=True, metadata={"description": "Mac"})
    subject_name = fields.String(required=True, metadata={"description": "Subject name"})
    san_list = fields.List(fields.String(), required=True, metadata={"description": "San list"})
    issuer = fields.String(required=True, metadata={"description": "Issuer"})
    valid_from = fields.DateTime(required=True, metadata={"description": "Valid from"})
    valid_to = fields.DateTime(required=True, metadata={"description": "Valid to"})
    signed_certificate_timestamp_list = fields.Boolean(required=True, metadata={"description": "Signed certificate timestamp list"})
    certificate_transparency_compliance = fields.Boolean(required=True, metadata={"description": "Certificate transparency compliance"})
    encrypted_client_hello = fields.Boolean(required=True, metadata={"description": "Encrypted client hello"})
 
class CertificateResponseSchema(Schema):
    class Meta:
        example = {
            "certificate_id": 42,
            "user_id": 1,
            "recent_compliance_id": 15,
            "created_at": "2024-01-15T10:30:00",
            "protocol": "TLSv1.3",
            "key_exchange": "ECDH",
            "key_exchange_group": "X25519",
            "cipher": "AES_128_GCM",
            "mac": "AEAD",
            "subject_name": "example.com",
            "san_list": ["example.com", "www.example.com"],
            "issuer": "Let's Encrypt",
            "valid_from": "2024-01-01T00:00:00",
            "valid_to": "2025-01-01T00:00:00",
            "signed_certificate_timestamp_list": True,
            "certificate_transparency_compliance": True,
            "encrypted_client_hello": False,
        }
    certificate_id = fields.Int(dump_only=True, metadata={"description": "Certificate ID"})
    user_id = fields.Int(dump_only=True, metadata={"description": "User ID"})
    recent_compliance_id = fields.Int(dump_only=True, allow_none=True, metadata={"description": "Recent compliance ID"})
    created_at = fields.DateTime(dump_only=True, metadata={"description": "Created at"})
    protocol = fields.String(dump_only=True, metadata={"description": "Protocol"})
    key_exchange = fields.String(dump_only=True, metadata={"description": "Key exchange"})
    key_exchange_group = fields.String(dump_only=True, metadata={"description": "Key exchange group"})
    cipher = fields.String(dump_only=True, metadata={"description": "Cipher"})
    mac = fields.String(dump_only=True, metadata={"description": "Mac"})
    subject_name = fields.String(dump_only=True, metadata={"description": "Subject name"})
    san_list = fields.List(fields.String(), dump_only=True, metadata={"description": "Subject Alternative Names"})
    issuer = fields.String(dump_only=True, metadata={"description": "Issuer"})
    valid_from = fields.DateTime(dump_only=True, metadata={"description": "Valid from"})
    valid_to = fields.DateTime(dump_only=True, metadata={"description": "Valid to"})
    signed_certificate_timestamp_list = fields.Boolean(dump_only=True, metadata={"description": "Signed certificate timestamp list"})
    certificate_transparency_compliance = fields.Boolean(dump_only=True, metadata={"description": "Certificate transparency compliance"})
    encrypted_client_hello = fields.Boolean(dump_only=True, metadata={"description": "Encrypted client hello"})
 
 
# --- Errors ---
 
class ErrorResponseSchema(Schema):
    """Error — 401, 403, 404, 409, 410"""
    class Meta:
        example = {
            "message": "Resource not found"
        }
    message = fields.String(dump_only=True, metadata={"description": "Message"})
 
class ValidationErrorResponseSchema(Schema):
    """422 - Validation Error"""
    class Meta:
        example = {
            "message": "Validation error",
            "errors": {
                "password": ["Shorter than minimum length 8"], 
                "email": ["Not a valid email address"]
            },
        }
    message = fields.String(dump_only=True, metadata={"description": "Message"})
    errors  = fields.Dict(
        keys=fields.String(),
        values=fields.List(fields.String()),
        dump_only=True,
        metadata={"description": "Errors"},
    )
 
 
# --- Compliance ---
 
class ComplianceResponseSchema(Schema):
    class Meta:
        example = {
            "compliance_id": 15,
            "certificate_id": 42,
            "policy_id": 3,
            "created_at": "2024-01-15T10:30:00",
            "has_valid_protocol": True,
            "has_valid_key_exchange": True,
            "has_valid_key_exchange_group": True,
            "has_valid_cipher": True,
            "has_valid_mac": True,
            "has_valid_domain": True,
            "has_valid_issuer": True,
            "has_valid_days_until_expiration": True,
            "has_valid_days_since_issuance": False,
            "has_valid_signed_certificate_timestamp_list": True,
            "has_valid_certificate_transparency_compliance": True,
            "has_valid_encrypted_client_hello": False,
        }
    compliance_id = fields.Int(dump_only=True, metadata={"description": "Compliance ID"})
    certificate_id = fields.Int(dump_only=True, metadata={"description": "Certificate ID"})
    policy_id = fields.Int(dump_only=True, metadata={"description": "Policy ID"})
    created_at = fields.DateTime(dump_only=True, metadata={"description": "Created at"})
    has_valid_protocol = fields.Boolean(dump_only=True, metadata={"description": "Has valid protocol"})
    has_valid_key_exchange = fields.Boolean(dump_only=True, metadata={"description": "Has valid key exchange"})
    has_valid_key_exchange_group = fields.Boolean(dump_only=True, metadata={"description": "Has valid key exchange group"})
    has_valid_cipher = fields.Boolean(dump_only=True, metadata={"description": "Has valid cipher"})
    has_valid_mac = fields.Boolean(dump_only=True, metadata={"description": "Has valid MAC"})
    has_valid_domain = fields.Boolean(dump_only=True, metadata={"description": "Has valid domain"})
    has_valid_issuer = fields.Boolean(dump_only=True, metadata={"description": "Has valid issuer"})
    has_valid_days_until_expiration = fields.Boolean(dump_only=True, metadata={"description": "Has valid days until expiration"})
    has_valid_days_since_issuance = fields.Boolean(dump_only=True, metadata={"description": "Has valid days since issuance"})
    has_valid_signed_certificate_timestamp_list = fields.Boolean(dump_only=True, metadata={"description": "Has valid signed certificate timestamp list"})
    has_valid_certificate_transparency_compliance = fields.Boolean(dump_only=True, metadata={"description": "Has valid certificate transparency compliance"})
    has_valid_encrypted_client_hello = fields.Boolean(dump_only=True, metadata={"description": "Has valid encrypted client hello"})
 
 
# Routes
 
_jwt_security = [{"bearerAuth": []}]
 
def _err(description):
    return {"description": description, "content": {"application/json": {"schema": ErrorResponseSchema()}}}
 
_validation_err = {"description": "Validation error", "content": {"application/json": {"schema": ValidationErrorResponseSchema()}}}
 
@authentication_blp.route("/sign-up", methods=["POST"])
@authentication_blp.arguments(SignUpRequestSchema)
@authentication_blp.response(201, AccessTokenResponseSchema)
@authentication_blp.doc(summary="Sign up", description="Sign up for an account.", responses={"409": _err("Username or email already registered"), "422": _validation_err})
def sign_up(body):
    existing_user = User.query.filter(
        (User.username == body["username"]) | (User.email == body["email"])
    ).first()
    
    if existing_user:
        abort(409, message="Username or email already registered")

    new_user = User(
        name=body["name"],
        username=body["username"],
        email=body["email"],
        password_hash=generate_password_hash(body["password"], method="pbkdf2:sha256")
    )
    
    db.session.add(new_user)
    db.session.commit()

    access_token = create_access_token(identity=str(new_user.user_id))
    
    return {"access_token": access_token}
 

@authentication_blp.route("/sign-in", methods=["POST"])
@authentication_blp.arguments(SignInRequestSchema)
@authentication_blp.response(200, AccessTokenResponseSchema)
@authentication_blp.doc(summary="Sign in", description="Sign in to an existing account.", responses={"401": _err("Invalid username or password"), "422": _validation_err})
def sign_in(body):
    user = User.query.filter_by(username=body["username"]).first()

    if not user or not check_password_hash(user.password_hash, body["password"]):
        abort(401, message="Invalid username or password")

    access_token = create_access_token(identity=str(user.user_id))
    
    return {"access_token": access_token}
 

@user_blp.route("/info", methods=["GET"])
@jwt_required()
@user_blp.response(200, UserResponseSchema)
@user_blp.doc(summary="Get user information", description="Get user information.", security=_jwt_security, responses={"401": _err("Missing or invalid token")})
def get_user_info():
    current_user_id = get_jwt_identity()
    
    user = User.query.get(current_user_id)
    
    if not user:
        abort(404, message="User not found")
        
    return user
 

@organisation_blp.route("/create", methods=["POST"])
@jwt_required()
@organisation_blp.arguments(CreateOrganisationRequestSchema)
@organisation_blp.response(201, OrganisationResponseSchema)
@organisation_blp.doc(summary="Create organisation", description="Create organisation.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("User is already a member of an organisation"), "409": _err("Organisation name already taken"), "422": _validation_err})
def create_organisation(body):
    current_user_id = int(get_jwt_identity())
 
    existing_membership = Membership.query.filter_by(user_id=current_user_id).first()
    if existing_membership:
        abort(403, message="User is already a member of an organisation")
 
    existing_org = Organisation.query.filter_by(name=body["name"]).first()
    if existing_org:
        abort(409, message="Organisation name already taken")
 
    organisation = Organisation(
        name=body["name"],
        owner_id=current_user_id,
    )
    db.session.add(organisation)
    db.session.flush()
 
    owner_role = Role.query.filter_by(name=RoleName.OWNER).first()
 
    membership = Membership(
        organisation_id=organisation.organisation_id,
        user_id=current_user_id,
        role_id=owner_role.role_id,
    )
    db.session.add(membership)
    db.session.commit()
 
    return organisation
 
@organisation_blp.route("/info", methods=["GET"])
@jwt_required()
@organisation_blp.response(200, OrganisationResponseSchema)
@organisation_blp.doc(summary="Get organisation information", description="Get organisation information.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "404": _err("User is not a member of any organisation")})
def get_organisation_info():
    current_user_id = int(get_jwt_identity())
 
    membership = Membership.query.filter_by(user_id=current_user_id).first()
    if not membership:
        abort(404, message="User is not a member of any organisation")
 
    return membership.organisation


@organisation_blp.route("/role", methods=["GET"])
@jwt_required()
@organisation_blp.response(200, MembershipRoleResponseSchema)
@organisation_blp.doc(summary="Get my role", description="Get the current user's role in their organisation.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "404": _err("User is not a member of any organisation")})
def get_my_role():
    current_user_id = int(get_jwt_identity())

    membership = Membership.query.filter_by(user_id=current_user_id).first()
    if not membership:
        abort(404, message="User is not a member of any organisation")

    return {"role": membership.role.name.value}


@invite_blp.route("/create", methods=["POST"])
@jwt_required()
@invite_blp.arguments(CreateInviteRequestSchema)
@invite_blp.response(201, InviteResponseSchema)
@invite_blp.doc(summary="Create invite", description="Create invite.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("User does not have permission to create invites"), "422": _validation_err})
def create_invite(body):
    current_user_id = int(get_jwt_identity())
 
    membership = Membership.query.filter_by(user_id=current_user_id).first()
    if not membership:
        abort(403, message="User does not have permission to create invites")
 
    caller_role = membership.role.name
    requested_role_name = RoleName(body["role"])
 
    if caller_role == RoleName.MEMBER:
        abort(403, message="User does not have permission to create invites")
    if caller_role == RoleName.ADMIN and requested_role_name != RoleName.MEMBER:
        abort(403, message="User does not have permission to create invites")
    if requested_role_name == RoleName.OWNER:
        abort(403, message="User does not have permission to create invites")
 
    target_role = Role.query.filter_by(name=requested_role_name).first()
 
    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
 
    invite = Invite(
        token_hash=token_hash,
        organisation_id=membership.organisation_id,
        role_id=target_role.role_id,
        max_usage=body.get("max_usage", 1),
    )
    db.session.add(invite)
    db.session.commit()
 
    return {
        "invite_id": invite.invite_id,
        "invite_code": raw_token,
        "role": invite.role.name.value,
        "expires_at": invite.expires_at,
        "usage_count": invite.usage_count,
        "max_usage": invite.max_usage,
        "created_at": invite.created_at,
    }
 
@invite_blp.route("/accept/<string:invite_code>", methods=["POST"])
@jwt_required()
@invite_blp.response(200, OrganisationResponseSchema)
@invite_blp.doc(summary="Accept invite", description="Accept invite.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "404": _err("Invite not found"), "409": _err("User is already a member of an organisation"), "410": _err("Invite has expired or reached its usage limit")})
def accept_invite(invite_code):
    current_user_id = int(get_jwt_identity())
 
    existing_membership = Membership.query.filter_by(user_id=current_user_id).first()
    if existing_membership:
        abort(409, message="User is already a member of an organisation")
 
    token_hash = hashlib.sha256(invite_code.encode()).hexdigest()
    invite = Invite.query.filter_by(token_hash=token_hash).first()
    if not invite:
        abort(404, message="Invite not found")
 
    now = datetime.now(timezone.utc)
    expires_at = invite.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
 
    if now > expires_at or invite.usage_count >= invite.max_usage:
        abort(410, message="Invite has expired or reached its usage limit")
 
    invite.usage_count += 1
 
    membership = Membership(
        organisation_id=invite.organisation_id,
        user_id=current_user_id,
        role_id=invite.role_id,
    )
    db.session.add(membership)
    db.session.commit()
 
    return invite.organisation
 
 
@consent_blp.route("/give/<int:policy_id>", methods=["POST"])
@jwt_required()
@consent_blp.response(201, ConsentResponseSchema)
@consent_blp.doc(summary="Give consent", description="Give consent.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "404": _err("Policy not found"), "409": _err("User has already given consent to this policy")})
def give_consent(policy_id):
    current_user_id = int(get_jwt_identity())

    policy = Policy.query.get(policy_id)
    if not policy:
        abort(404, message="Policy not found")

    existing = Consent.query.filter_by(user_id=current_user_id, policy_id=policy_id).first()
    if existing:
        if existing.has_consent:
            abort(409, message="User has already given consent to this policy")
        # Re-consent after a prior revocation: update the existing record
        existing.has_consent = True
        existing.revoked_at = None
        existing.created_at = datetime.now(timezone.utc)
        db.session.commit()
        return existing

    consent = Consent(
        user_id=current_user_id,
        policy_id=policy_id,
        has_consent=True,
    )
    db.session.add(consent)
    db.session.commit()

    return consent
 
@consent_blp.route("/revoke/<int:policy_id>", methods=["PATCH"])
@jwt_required()
@consent_blp.response(200, ConsentResponseSchema)
@consent_blp.doc(summary="Revoke consent", description="Revoke consent.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "404": _err("Consent record not found for this policy")})
def revoke_consent(policy_id):
    current_user_id = int(get_jwt_identity())

    consent = Consent.query.filter_by(user_id=current_user_id, policy_id=policy_id).first()
    if not consent:
        abort(404, message="Consent record not found for this policy")

    consent.has_consent = False
    consent.revoked_at = datetime.now(timezone.utc)
    db.session.commit()

    return consent

@consent_blp.route("/<int:policy_id>", methods=["GET"])
@jwt_required()
@consent_blp.response(200, ConsentResponseSchema)
@consent_blp.doc(summary="Get consent", description="Get consent.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "404": _err("Consent record not found for this policy")})
def get_consent(policy_id):
    current_user_id = int(get_jwt_identity())

    consent = Consent.query.filter_by(user_id=current_user_id, policy_id=policy_id).first()
    if not consent:
        abort(404, message="Consent record not found for this policy")

    return consent
 
@consent_blp.route("/list", methods=["GET"])
@jwt_required()
@consent_blp.response(200, ConsentResponseSchema(many=True))
@consent_blp.doc(summary="List consents", description="List consents.", security=_jwt_security, responses={"401": _err("Missing or invalid token")})
def list_consents():
    current_user_id = int(get_jwt_identity())

    consents = Consent.query.filter_by(user_id=current_user_id).all()
    return consents
 
 
@policy_blp.route("/list", methods=["GET"])
@jwt_required()
@policy_blp.response(200, PolicyResponseSchema(many=True))
@policy_blp.doc(summary="List policies", description="List policies.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "404": _err("User is not a member of any organisation")})
def list_policies():
    current_user_id = int(get_jwt_identity())

    membership = Membership.query.filter_by(user_id=current_user_id).first()
    if not membership:
        abort(404, message="User is not a member of any organisation")

    policies = Policy.query.filter_by(organisation_id=membership.organisation_id).all()
    return policies
 
@policy_blp.route("/create", methods=["POST"])
@jwt_required()
@policy_blp.arguments(CreatePolicyRequestSchema)
@policy_blp.response(201, PolicyResponseSchema)
@policy_blp.doc(summary="Create policy", description="Create policy.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("User does not have permission to create policies"), "422": _validation_err})
def create_policy(body):
    current_user_id = int(get_jwt_identity())

    membership = Membership.query.filter_by(user_id=current_user_id).first()
    if not membership or membership.role.name == RoleName.MEMBER:
        abort(403, message="User does not have permission to create policies")

    policy = Policy(
        organisation_id=membership.organisation_id,
        valid_protocols=body["valid_protocols"],
        valid_key_exchanges=body["valid_key_exchanges"],
        valid_key_exchange_groups=body["valid_key_exchange_groups"],
        valid_ciphers=body["valid_ciphers"],
        valid_macs=body["valid_macs"],
        valid_domains=body["valid_domains"],
        valid_issuers=body["valid_issuers"],
        min_days_until_expiration=body["min_days_until_expiration"],
        max_days_since_issuance=body["max_days_since_issuance"],
        require_signed_certificate_timestamp_list=body["require_signed_certificate_timestamp_list"],
        require_certificate_transparency_compliance=body["require_certificate_transparency_compliance"],
        require_encrypted_client_hello=body["require_encrypted_client_hello"],
    )
    db.session.add(policy)
    db.session.commit()

    return policy
 
@policy_blp.route("/active", methods=["GET"])
@jwt_required()
@policy_blp.response(200, PolicyResponseSchema)
@policy_blp.doc(summary="Get active policy", description="Get active policy.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "404": _err("Organisation has no active policy set")})
def get_active_policy():
    current_user_id = int(get_jwt_identity())

    membership = Membership.query.filter_by(user_id=current_user_id).first()
    if not membership:
        abort(404, message="User is not a member of any organisation")

    organisation = membership.organisation
    if not organisation.active_policy_id:
        abort(404, message="Organisation has no active policy set")

    return organisation.active_policy
 
@policy_blp.route("/<int:policy_id>", methods=["GET"])
@jwt_required()
@policy_blp.response(200, PolicyResponseSchema)
@policy_blp.doc(summary="Get policy", description="Get policy.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("Policy does not belong to the user's organisation"), "404": _err("Policy not found")})
def get_policy(policy_id):
    current_user_id = int(get_jwt_identity())

    membership = Membership.query.filter_by(user_id=current_user_id).first()
    if not membership:
        abort(403, message="Policy does not belong to the user's organisation")

    policy = Policy.query.get(policy_id)
    if not policy:
        abort(404, message="Policy not found")

    if policy.organisation_id != membership.organisation_id:
        abort(403, message="Policy does not belong to the user's organisation")

    return policy
 
@policy_blp.route("/active/<int:policy_id>", methods=["POST"])
@jwt_required()
@policy_blp.response(200, OrganisationResponseSchema)
@policy_blp.doc(summary="Set active policy", description="Set active policy.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("User does not have permission to set the active policy"), "404": _err("Policy not found")})
def set_active_policy(policy_id):
    current_user_id = int(get_jwt_identity())

    membership = Membership.query.filter_by(user_id=current_user_id).first()
    if not membership or membership.role.name == RoleName.MEMBER:
        abort(403, message="User does not have permission to set the active policy")

    policy = Policy.query.get(policy_id)
    if not policy:
        abort(404, message="Policy not found")

    if policy.organisation_id != membership.organisation_id:
        abort(403, message="User does not have permission to set the active policy")

    organisation = membership.organisation
    organisation.active_policy_id = policy.policy_id
    db.session.commit()

    return organisation
 
 
@certificate_blp.route("/list", methods=["GET"])
@jwt_required()
@certificate_blp.response(200, CertificateResponseSchema(many=True))
@certificate_blp.doc(summary="List certificates", description="List certificates.", security=_jwt_security, responses={"401": _err("Missing or invalid token")})
def list_certificates():
    pass
 
@certificate_blp.route("/create", methods=["POST"])
@jwt_required()
@certificate_blp.arguments(CreateCertificateRequestSchema)
@certificate_blp.response(201, CertificateResponseSchema)
@certificate_blp.doc(summary="Create certificate", description="Create certificate.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "422": _validation_err})
def create_certificate(body):
    pass
 
@certificate_blp.route("/<int:certificate_id>", methods=["GET"])
@jwt_required()
@certificate_blp.response(200, CertificateResponseSchema)
@certificate_blp.doc(summary="Get certificate", description="Get certificate.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("Certificate does not belong to the current user"), "404": _err("Certificate not found")})
def get_certificate(certificate_id):
    pass
 
 
@compliance_blp.route("/list/<int:certificate_id>", methods=["GET"])
@jwt_required()
@compliance_blp.response(200, ComplianceResponseSchema(many=True))
@compliance_blp.doc(summary="List compliances", description="List compliances.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("Certificate does not belong to the current user"), "404": _err("Certificate not found")})
def list_compliances(certificate_id):
    pass
 
@compliance_blp.route("/check/<int:certificate_id>", methods=["POST"])
@jwt_required()
@compliance_blp.response(201, ComplianceResponseSchema)
@compliance_blp.doc(summary="Check compliance", description="Check compliance.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("Certificate does not belong to the current user, or user has not consented to the active policy"), "404": _err("Certificate not found, or organisation has no active policy")})
def check_compliance(certificate_id):
    pass
 
@compliance_blp.route("/check/all", methods=["POST"])
@jwt_required()
@compliance_blp.response(201, ComplianceResponseSchema(many=True))
@compliance_blp.doc(summary="Check compliances", description="Check compliances.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("One or more certificates do not belong to the current user, or user has not consented to the active policy"), "404": _err("One or more certificates not found, or organisation has no active policy"), "422": _validation_err})
def check_compliances():
    pass
 
@compliance_blp.route("/recent/<int:certificate_id>", methods=["GET"])
@jwt_required()
@compliance_blp.response(200, ComplianceResponseSchema)
@compliance_blp.doc(summary="Get recent compliance", description="Get recent compliance.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("Certificate does not belong to the current user"), "404": _err("Certificate not found, or no compliance checks have been run yet")})
def get_recent_compliance(certificate_id):
    pass
 
@compliance_blp.route("/<int:compliance_id>", methods=["GET"])
@jwt_required()
@compliance_blp.response(200, ComplianceResponseSchema)
@compliance_blp.doc(summary="Get compliance", description="Get compliance.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("Compliance record does not belong to the current user"), "404": _err("Compliance record not found")})
def get_compliance(compliance_id):
    pass
 
@compliance_blp.route("/policy/<int:compliance_id>", methods=["GET"])
@jwt_required()
@compliance_blp.response(200, PolicyResponseSchema)
@compliance_blp.doc(summary="Get compliance policy", description="Get compliance policy.", security=_jwt_security, responses={"401": _err("Missing or invalid token"), "403": _err("Compliance record does not belong to the current user"), "404": _err("Compliance record not found")})
def get_compliance_policy(compliance_id):
    pass
 
 
# Register blueprint
 
api.register_blueprint(authentication_blp)
api.register_blueprint(user_blp)
api.register_blueprint(consent_blp)
api.register_blueprint(organisation_blp)
api.register_blueprint(invite_blp)
api.register_blueprint(policy_blp)
api.register_blueprint(certificate_blp)
api.register_blueprint(compliance_blp)
 
 
with app.app_context():
    db.create_all()

    for role_name in RoleName:
        if not Role.query.filter_by(name=role_name).first():
            db.session.add(Role(name=role_name))
    db.session.commit()
 
 
if __name__ == '__main__':
    app.run()