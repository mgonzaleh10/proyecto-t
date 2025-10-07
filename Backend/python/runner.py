import argparse
import os
import papermill as pm

def main():
  parser = argparse.ArgumentParser()
  parser.add_argument("--nb", required=True, help="Ruta al notebook .ipynb")
  parser.add_argument("--in_xlsx", required=True, help="Excel de entrada para el modelo")
  parser.add_argument("--out_xlsx", required=True, help="Excel de salida del modelo (generado por el notebook)")
  parser.add_argument("--params", default="", help="Params extra 'k=v,k2=v2' (opcional)")
  args = parser.parse_args()

  # Parametrización para el notebook (si el notebook ya usa variables)
  # Asignamos rutas que el notebook pueda leer (ajusta los nombres a tus celdas/variables)
  nb_params = {
    "INPUT_EXCEL_PATH": os.path.abspath(args.in_xlsx),
    "OUTPUT_EXCEL_PATH": os.path.abspath(args.out_xlsx)
  }

  if args.params:
    for kv in args.params.split(","):
      if "=" in kv:
        k, v = kv.split("=", 1)
        nb_params[k] = v

  # Ejecuta el notebook con papermill
  pm.execute_notebook(
    input_path=args.nb,
    output_path=os.path.abspath(args.nb) + ".executed.ipynb",
    parameters=nb_params
  )

  # Si tu notebook no usa parámetros y simplemente lee algo fijo,
  # igual se ejecuta. En ese caso, asegúrate que el notebook escriba args.out_xlsx.

  print("OK")

if __name__ == "__main__":
  main()
