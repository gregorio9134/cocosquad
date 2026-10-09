# Instrucciones para sincronizar Coco Squad en Windows

## Objetivo

Preparar en esta notebook Windows el repositorio Coco Squad y dejar abierta la
rama de trabajo que ya se publicó desde la Mac. No implementar funciones nuevas,
no modificar archivos del producto y no mezclar cambios con `main`.

## Datos confirmados

- Repositorio: `https://github.com/gregorio9134/Coco-Squad.git`
- Rama que se debe usar: `refactor/coco-client-modules`
- Commit que debe quedar activo: el último commit publicado en la rama `refactor/coco-client-modules`.
- La rama está publicada en GitHub. `main` no contiene estos cambios todavía.

## Instrucciones para el agente de VS Code / Antigravity en Windows

Actúa como asistente técnico y realiza la sincronización de forma segura. El
usuario no tiene experiencia programando, así que encárgate de los pasos
posibles y explica cualquier ventana de autorización en palabras simples.

1. Comprueba qué carpeta está abierta en VS Code / Antigravity y si contiene un repositorio
   Git. No ejecutes comandos de Git desde una carpeta que no sea el proyecto.
2. Si ya hay una copia de Coco Squad:
   - Comprueba el remoto. Debe ser
     `https://github.com/gregorio9134/Coco-Squad.git`.
   - Ejecuta `git status --short --branch`.
   - Si hay cambios locales sin guardar en un commit, **detente**. No los borres,
     no los guardes encima ni cambies de rama; explica al usuario lo que
     encontraste y pide ayuda antes de continuar.
3. Si no hay una copia local de Coco Squad, clónala con la interfaz de VS Code o
   en una carpeta nueva llamada `Coco-Squad` dentro de Documentos. Si esa
   carpeta ya existe y no sabes si contiene trabajo, inspecciónala primero y no
   la sobrescribas.
4. Actualiza la información remota con `git fetch origin` (o `git fetch coco-squad`).
5. Cambia a `refactor/coco-client-modules`. Si no existe una rama local,
   créala siguiendo `origin/refactor/coco-client-modules`.
6. Actualiza la rama con `git pull --ff-only origin refactor/coco-client-modules`.
   No hagas merge, rebase, reset, cherry-pick ni push.
7. Comprueba que la carpeta de trabajo quedó limpia con `git status --short --branch`.
8. Lee atentamente la sección **"ACTUALIZACION DE SESION: 9 DE OCTUBRE DE 2026"** al final de `comunicacion entre notebooks.txt` y `docs/COMPORTAMIENTO-COCOS.md`.
9. Explica al usuario que la sincronización terminó y confirma:
   - Que conoces el estado de los servidores en Oracle Cloud (Jarvis-bot y Coco-Staging).
   - Que sabes que el cazador de 12GB v4.1 está corriendo en segundo plano sin spam en Telegram.
   - Que el bot de trading fue eliminado.
   - Que se mantiene la estética oficial y pura de Coucou sin modificaciones innecesarias, enfocándonos en asignar funciones a Coco Blanco, Verde y Rojo.

## Seguridad y ayuda al usuario

- No pidas al usuario que copie contraseñas, tokens, claves SSH ni claves del
  servidor. Si GitHub pide autorización, usa la ventana oficial de inicio de
  sesión de VS Code/GitHub y explica que debe aceptarla.
- No publiques credenciales ni archivos locales de configuración.
- Si aparece un conflicto, un error de permisos o una rama con trabajo local,
  detente sin borrar ni sobrescribir nada. Comparte el mensaje de error y pide
  asistencia.
- Si no puedes ejecutar una operación, no digas que se completó: explica qué
  paso quedó pendiente y ofrece la siguiente acción más simple.
