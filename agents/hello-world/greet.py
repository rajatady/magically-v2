import os
import json

name = os.environ.get("GREETING_NAME", "World")
result = {"message": f"Hello, {name}!", "from": "hello-world agent", "python_version": os.sys.version}
print(json.dumps(result))
