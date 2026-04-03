# API

## Prerequisites

- Install [Python](https://www.python.org/)

## Create Virtual Environment

```bash
python -m venv venv # windows
python3 -m venv venv # mac and linux
```

## Activate Virtual Environment
```bash
venv\Scripts\activate # windows (cmd.exe)
venv\Scripts\Activate.ps1 # windows (powershell)
source venv/bin/activate # mac and linux
```

## Install Dependencies

```bash
pip install -r requirements.txt
```

### Development
```bash
python -m flask --app main run # windows
python3 -m flask --app main run # mac and linux
```

## Deactivate Virtual Environment
```bash
deactivate
```