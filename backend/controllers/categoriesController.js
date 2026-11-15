import { withTransaction } from "../configs/db.js";
import * as categoriesRepo from "../databaseRepos/categoriesRepo.js";
import { HttpError, notFound } from "../utils/httpError.js";
import { cleanText, idParam, requireBody } from "../utils/validate.js";

const nameFrom = (body) => cleanText(body.name, "Nombre", { required: true, max: 60 });

async function assertNameFree(name, excludeId = 0) {
  if (await categoriesRepo.existsByName(name, excludeId)) {
    throw new HttpError(409, `Ya existe una categoría llamada "${name}".`);
  }
}

export async function list(req, res) {
  res.json(await categoriesRepo.getAll());
}

export async function create(req, res) {
  const name = nameFrom(requireBody(req));
  await assertNameFree(name);
  res.status(201).json(await categoriesRepo.create(name));
}

export async function rename(req, res) {
  const id = idParam(req);
  const name = nameFrom(requireBody(req));
  if (!(await categoriesRepo.getById(id))) throw notFound("la categoría");
  await assertNameFree(name, id);
  res.json(await categoriesRepo.rename(id, name));
}

export async function remove(req, res) {
  const id = idParam(req);
  if (!(await categoriesRepo.getById(id))) throw notFound("la categoría");
  const count = await categoriesRepo.countProducts(id);
  if (count > 0) {
    throw new HttpError(409, `Primero mueve o elimina ${count === 1 ? "su producto" : `sus ${count} productos`}.`);
  }
  await categoriesRepo.remove(id);
  res.status(204).end();
}

// Body: { ids: [3, 1, 2, ...] } with every category id in the new order
export async function reorder(req, res) {
  const body = requireBody(req);
  const ids = Array.isArray(body.ids) ? body.ids.map(Number) : null;
  const existing = await categoriesRepo.allIds();
  const valid =
    ids &&
    ids.length === existing.length &&
    new Set(ids).size === ids.length &&
    existing.every((id) => ids.includes(id));
  if (!valid) throw new HttpError(400, "Envía todos los id de categoría en el nuevo orden.");

  await withTransaction((conn) => categoriesRepo.setOrder(ids, conn));
  res.json(await categoriesRepo.getAll());
}
