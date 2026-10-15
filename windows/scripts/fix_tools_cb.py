import os

# 1. Patch tool_registry.py
path = "/home/ubuntu/agente-staging/tools/tool_registry.py"
with open(path, "r", encoding="utf-8") as f:
    code = f.read()

if "def get(self, name):" not in code:
    code = code.replace(
        "    def get_available_tools(self):",
        "    def get(self, name):\n        return self.tools.get(name)\n\n    def get_available_tools(self):"
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(code)
    print("tool_registry.py patched with get() method.")
else:
    print("tool_registry.py already has get().")

# 2. Patch circuit_breaker.py
cb_path = "/home/ubuntu/agente-staging/circuit_breaker.py"
with open(cb_path, "r", encoding="utf-8") as f:
    cb_code = f.read()

old_cb_line = "        tool = registry.get(fn_name)\n        result = tool.run(**fn_args) if tool else f\"Tool '{fn_name}' not found\""
new_cb_line = """        tool = getattr(registry, "get", lambda n: registry.tools.get(n))(fn_name) if hasattr(registry, "tools") or hasattr(registry, "get") else None
        if hasattr(tool, "run"):
            result = tool.run(**fn_args)
        elif callable(tool):
            result = tool(**fn_args)
        elif hasattr(registry, "execute_tool"):
            result = registry.execute_tool(fn_name, **fn_args)
        else:
            result = f"Tool '{fn_name}' not found" """

if old_cb_line in cb_code:
    cb_code = cb_code.replace(old_cb_line, new_cb_line)
    with open(cb_path, "w", encoding="utf-8") as f:
        f.write(cb_code)
    print("circuit_breaker.py patched safely.")
else:
    print("circuit_breaker.py already patched or pattern matched.")
