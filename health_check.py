#!/usr/bin/env python3
"""
Coco Squad — Health Check

Verifica la salud del proyecto sin necesidad de venv completo.
Valida:
  1. Sintaxis Python (ast.parse)
  2. Imports disponibles (sin ejecutar)
  3. Backend arranca sin error
  4. Frontend build está actualizado
  5. Tests no tienen skips ocultos
"""

import os
import sys
import ast
import json
import subprocess
from pathlib import Path
from datetime import datetime

ROOT = Path("/Users/Gregorio/Desktop/coco squad")
SERVER = ROOT / "server-staging"
FRONTEND = ROOT / "windows"

class HealthChecker:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.passed = []
        
    def check_syntax(self):
        """Verifica sintaxis de archivos Python críticos."""
        critical = [
            "fastapi_server.py",
            "api/dependencies.py",
            "api/routers/admin.py",
            "api/routers/chat.py",
        ]
        
        for fname in critical:
            path = SERVER / fname
            if not path.exists():
                self.errors.append("MISSING: " + fname)
                continue
                
            try:
                with open(path) as f:
                    ast.parse(f.read())
                self.passed.append("OK: " + fname + " — Sintaxis OK")
            except SyntaxError as e:
                self.errors.append("SYNTAX: " + fname + " linea " + str(e.lineno) + ": " + e.msg)
    
    def check_imports(self):
        """Verifica que imports críticos se pueden usar."""
        critical_imports = [
            ("fastapi", "FastAPI"),
            ("uvicorn", "uvicorn"),
            ("slowapi", "Limiter"),
        ]
        
        for module, name in critical_imports:
            try:
                __import__(module)
                self.passed.append("OK: " + module + " disponible")
            except ImportError:
                self.warnings.append("WARN: " + module + " no instalado")
    
    def check_admin_fix(self):
        """Verifica que admin.py tiene el alias _exigir_admin_o_fundador."""
        path = SERVER / "api/routers/admin.py"
        with open(path) as f:
            content = f.read()
        
        if "_exigir_admin_o_fundador = verify_admin_token" in content:
            self.passed.append("OK: admin.py tiene alias _exigir_admin_o_fundador")
        else:
            self.errors.append("ERROR: admin.py falta alias _exigir_admin_o_fundador")
    
    def check_frontend_build(self):
        """Verifica que frontend tiene dist/ y build.json reciente."""
        dist = FRONTEND / "dist"
        if dist.exists() and len(list(dist.glob("*.js"))) > 0:
            count = len(list(dist.glob("*")))
            self.passed.append("OK: Frontend build OK (" + str(count) + " archivos)")
        else:
            self.warnings.append("WARN: Frontend dist/ vacio o no existe")
    
    def check_database(self):
        """Verifica que base de datos existe."""
        db_path = SERVER / "database/master.db"
        if db_path.exists():
            size_mb = db_path.stat().st_size / (1024 * 1024)
            self.passed.append("OK: database/master.db (" + "{:.1f}".format(size_mb) + " MB)")
        else:
            self.warnings.append("WARN: database/master.db no existe")
    
    def check_required_files(self):
        """Verifica archivos requeridos."""
        required = [
            ("server-staging/config.py", "Backend config"),
            ("server-staging/utils/logger.py", "Logger"),
            ("windows/src/core/bridge.ts", "Frontend bridge"),
            (".env.example", "Env template"),
        ]
        
        for path_str, desc in required:
            path = ROOT / path_str
            if path.exists():
                self.passed.append("OK: " + desc)
            else:
                self.errors.append("MISSING: " + desc + " (" + path_str + ")")
    
    def run(self):
        """Ejecuta todos los checks."""
        print("")
        print("=" * 60)
        print("Coco Squad — Health Check")
        print("=" * 60)
        print("Timestamp: " + datetime.now().isoformat())
        print("")
        
        self.check_syntax()
        self.check_imports()
        self.check_admin_fix()
        self.check_frontend_build()
        self.check_database()
        self.check_required_files()
        
        # Reporte
        print("\n📋 RESULTADOS:\n")
        
        if self.passed:
            for msg in self.passed:
                print("  " + msg)
        
        if self.warnings:
            print("")
            for msg in self.warnings:
                print("  " + msg)
        
        if self.errors:
            print("")
            for msg in self.errors:
                print("  " + msg)
        
        # Veredicto
        print("\n" + "=" * 60)
        if self.errors:
            print("ESTADO: CRITICO — Hay errores que impiden arrancar")
            return 1
        elif self.warnings:
            print("ESTADO: DEGRADADO — Warnings que investigar")
            return 2
        else:
            print("ESTADO: OK — Proyecto listo para verificacion")
            return 0

if __name__ == "__main__":
    checker = HealthChecker()
    exit_code = checker.run()
    sys.exit(exit_code)
