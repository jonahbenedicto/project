from flask import Flask
import os
from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager, jwt_required
from sqlalchemy.dialects.postgresql import ARRAY as Array
from datetime import datetime, timezone, timedelta
import enum

app = Flask(__name__)

db_url = os.environ.get("DATABASE_URL", "postgresql://devuser:devpassword@localhost:5432/devdatabase")
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config["JWT_SECRET_KEY"] = os.environ.get("JWT_SECRET_KEY", "super-secret-local-key")

db = SQLAlchemy(app)
jwt = JWTManager(app)


# Models

class RoleName(enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"


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


class Organisation(db.Model):
    __tablename__ = "organisations"

    organisation_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.Text, unique=True, nullable=False)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    active_policy_id = db.Column(db.Integer, db.ForeignKey('policies.policy_id', use_alter=True), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    policies = db.relationship("Policy", foreign_keys="Policy.organisation_id")
    active_policy = db.relationship("Policy", foreign_keys=[active_policy_id], uselist=False)
    invites = db.relationship("Invite")


class Invite(db.Model):
    __tablename__ = 'invites'

    invite_id = db.Column(db.Integer, primary_key=True)
    token_hash = db.Column(db.Text, unique=True, nullable=False)
    organisation_id = db.Column(db.Integer, db.ForeignKey('organisations.organisation_id'), nullable=False)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.role_id'), nullable=False, default=RoleName.MEMBER.value)
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

    organisation_id = db.Column(db.Integer, db.ForeignKey('organisations.organisation_id'), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), primary_key=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.role_id'), nullable=False)
    joined_at = db.Column(db.DateTime, nullable=False, default=lambda: datetime.now(timezone.utc))

    organisation = db.relationship("Organisation")
    role = db.relationship("Role")


class Certificate(db.Model):
    __tablename__ = "certificates"

    certificate_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.user_id'), nullable=False)
    recent_compliance_id = db.Column(db.Integer, db.ForeignKey('compliance.id', use_alter=True), nullable=True)
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

    id = db.Column(db.Integer, primary_key=True)
    certificate_id = db.Column(db.Integer, db.ForeignKey('certificates.certificate_id'), nullable=False)
    policy_id = db.Column(db.Integer, db.ForeignKey('policies.policy_id'), nullable=False)
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
    organisation_id = db.Column(db.Integer, db.ForeignKey('organisations.organisation_id'), nullable=False)
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


# Routes

# User
@app.route("/api/v1/user", methods=["POST"]) # Sign Up
def create_user():
    pass

@app.route("/api/v1/user", methods=["GET"])
@jwt_required()
def get_user():
    pass

@app.route("/api/v1/user", methods=["PUT"])
@jwt_required()
def update_user():
    pass

@app.route("/api/v1/user", methods=["DELETE"])
@jwt_required()
def delete_user():
    pass

@app.route("/api/v1/user/authenticate", methods=["POST"]) # Sign In
def authenticate_user():
    pass

# Organisation
@app.route("/api/v1/user/organisation", methods=["POST"])
@jwt_required()
def create_organisation():
    pass

@app.route("/api/v1/user/organisation", methods=["GET"])
@jwt_required()
def get_organisation():
    pass

@app.route("/api/v1/user/organisation", methods=["PUT"])
@jwt_required()
def update_organisation():
    pass

@app.route("/api/v1/user/organisation", methods=["DELETE"])
@jwt_required()
def delete_organisation():
    pass

@app.route("/api/v1/user/organisation/leave", methods=["POST"])
@jwt_required()
def leave_organisation():
    pass

# Organisation Owner
@app.route("/api/v1/user/organisation/members", methods=["GET"])
@jwt_required()
def get_organisation_members():
    pass

@app.route("/api/v1/user/organisation/member/remove", methods=["POST"])
@jwt_required()
def remove_organisation_member():
    pass

@app.route("/api/v1/user/organisation/member/role", methods=["PUT"])
@jwt_required()
def update_organisation_member_role():
    pass

# Invite
@app.route("/api/v1/user/organisation/invite", methods=["POST"])
@jwt_required()
def create_organisation_invite():
    pass

@app.route("/api/v1/user/organisation/invites", methods=["GET"])
@jwt_required()
def get_organisation_invites():
    pass

@app.route("/api/v1/user/organisation/invite/<int:invite_id>", methods=["DELETE"])
@jwt_required()
def delete_organisation_invite(invite_id):
    pass

@app.route("/api/v1/user/invite/<string:invite_code>/accept", methods=["POST"])
@jwt_required()
def accept_organisation_invite(invite_code):
    pass

# Policy
@app.route("/api/v1/user/organisation/policies", methods=["GET"])
@jwt_required()
def get_organisation_policies():
    pass

@app.route("/api/v1/user/organisation/policy", methods=["POST"])
@jwt_required()
def create_organisation_policy():
    pass

@app.route("/api/v1/user/organisation/policy/<int:policy_id>", methods=["GET"])
@jwt_required()
def get_organisation_policy(policy_id):
    pass

@app.route("/api/v1/user/organisation/policy/<int:policy_id>", methods=["PUT"])
@jwt_required()
def update_organisation_policy(policy_id):
    pass

@app.route("/api/v1/user/organisation/policy/<int:policy_id>", methods=["DELETE"])
@jwt_required()
def delete_organisation_policy(policy_id):
    pass

@app.route("/api/v1/user/organisation/active-policy", methods=["GET"])
@jwt_required()
def get_organisation_active_policy():
    pass

@app.route("/api/v1/user/organisation/active-policy", methods=["PUT"])
@jwt_required()
def update_organisation_active_policy():
    pass

@app.route("/api/v1/user/organisation/active-policy", methods=["DELETE"])
@jwt_required()
def delete_organisation_active_policy():
    pass

@app.route("/api/v1/user/organisation/active-policy/<int:policy_id>", methods=["POST"])
@jwt_required()
def activate_organisation_policy(policy_id):
    pass

# Certificate
@app.route("/api/v1/user/certificate", methods=["POST"])
@jwt_required()
def create_certificate(): # Create certificate and compliance
    pass

@app.route("/api/v1/user/certificates", methods=["GET"])
@jwt_required()
def get_certificates():
    pass

@app.route("/api/v1/user/certificate/<int:certificate_id>", methods=["GET"])
@jwt_required()
def get_certificate(certificate_id):
    pass

@app.route("/api/v1/user/certificate/<int:certificate_id>", methods=["DELETE"])
@jwt_required()
def delete_certificate(certificate_id):
    pass

# Compliance
@app.route("/api/v1/user/certificate/<int:certificate_id>/compliance", methods=["POST"])
@jwt_required()
def run_certificate_compliance(certificate_id):
    pass

@app.route("/api/v1/user/certificates/compliance", methods=["POST"])
@jwt_required()
def run_certificates_compliance():
    pass

@app.route("/api/v1/user/certificate/<int:certificate_id>/recent-compliance", methods=["GET"])
@jwt_required()
def get_certificate_recent_compliance(certificate_id):
    pass

@app.route("/api/v1/user/certificate/<int:certificate_id>/compliances", methods=["GET"])
@jwt_required()
def get_certificate_compliances(certificate_id):
    pass


@app.route("/api/v1/user/certificate/compliance/<int:compliance_id>", methods=["GET"])
@jwt_required()
def get_certificate_compliance(compliance_id):
    pass

@app.route("/api/v1/user/certificate/compliance/<int:compliance_id>/policy", methods=["GET"])
@jwt_required()
def get_compliance_policy(compliance_id):
    pass


with app.app_context():
    db.create_all()


if __name__ == '__main__':
    app.run()