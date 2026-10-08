# Instrucciones para sincronizar Coco Squad en Windows

## Objetivo

Preparar en esta notebook Windows el repositorio Coco Squad y dejar abierta la
rama de trabajo que ya se publicó desde la Mac. No implementar funciones nuevas,
no modificar archivos del producto y no mezclar cambios con `main`.

## Datos confirmados

- Repositorio: `https://github.com/gregorio9134/Coco-Squad.git`
- Rama que se debe usar: `refactor/coco-client-modules`
- Commit que debe quedar activo:
  `31765ef9eb798c6bfae2f54b5166193e532b5c42`
- La rama está publicada en GitHub. `main` no contiene estos cambios todavía.

## Instrucciones para el agente de VS Code

Actúa como asistente técnico y realiza la sincronización de forma segura. El
usuario no tiene experiencia programando, así que encárgate de los pasos
posibles y explica cualquier ventana de autorización en palabras simples.

1. Comprueba qué carpeta está abierta en VS Code y si contiene un repositorio
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
4. Actualiza la información remota con `git fetch origin`.
5. Cambia a `refactor/coco-client-modules`. Si no existe una rama local,
   créala siguiendo `origin/refactor/coco-client-modules`.
6. Actualiza la rama con `git pull --ff-only origin refactor/coco-client-modules`.
   No hagas merge, rebase, reset, cherry-pick ni push.
7. Comprueba que `git rev-parse HEAD` da exactamente:
   `31765ef9eb798c6bfae2f54b5166193e532b5c42`.
8. Comprueba que la carpeta de trabajo quedó limpia con `git status
   --short --branch`.
9. Lee `comunicacion entre notebooks.txt` y `docs/COMPORTAMIENTO-COCOS.md`.
   Explica al usuario que la sincronización terminó y resume cómo están
   definidos Coco Blanco, Verde, Rojo y Azul. Aclara que esas capacidades son
   una especificación funcional y que Azul y varias funciones avanzadas aún
   requieren implementación en el servidor.

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
