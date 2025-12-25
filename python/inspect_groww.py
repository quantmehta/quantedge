import growwapi
import inspect

api_methods = inspect.getmembers(growwapi.GrowwAPI, predicate=inspect.isfunction)
with open("groww_methods.txt", "w") as f:
    for name, method in api_methods:
        f.write(f"{name}: {inspect.signature(method)}\n")
