"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  categoryKeys,
  createCategory,
  deleteCategory,
  getCategories,
  reorderCategories,
  updateCategory,
} from "@/lib/api/categories";
import { getProducts, productKeys } from "@/lib/api/products";
import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/Icons";
import { plural } from "@/lib/format";
import ui from "@/components/dashboard/dash.module.css";
import styles from "./categories.module.css";

export default function CategoriesPage() {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({ queryKey: categoryKeys.all, queryFn: getCategories });
  const productsQuery = useQuery({ queryKey: productKeys.all, queryFn: getProducts });

  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name }
  const [deleting, setDeleting] = useState(null);

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const counts = useMemo(() => {
    const map = new Map();
    for (const p of productsQuery.data ?? []) {
      const c = map.get(p.categoryId) ?? { total: 0, available: 0 };
      c.total += 1;
      if (p.isAvailable) c.available += 1;
      map.set(p.categoryId, c);
    }
    return map;
  }, [productsQuery.data]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: categoryKeys.all });

  const add = useMutation({
    mutationFn: () => createCategory(newName.trim()),
    onSuccess: () => {
      setNewName("");
      refresh();
    },
  });

  const rename = useMutation({
    mutationFn: ({ id, name }) => updateCategory(id, { name: name.trim() }),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
  });

  const move = useMutation({
    mutationFn: (ids) => reorderCategories(ids),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: categoryKeys.all });
      const previous = queryClient.getQueryData(categoryKeys.all);
      queryClient.setQueryData(categoryKeys.all, (list = []) =>
        ids.map((id, i) => ({ ...list.find((c) => c.id === id), sortOrder: i + 1 }))
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(categoryKeys.all, ctx.previous),
    onSettled: refresh,
  });

  const remove = useMutation({
    mutationFn: (category) => deleteCategory(category.id),
    onSuccess: () => {
      setDeleting(null);
      refresh();
    },
  });

  const moveBy = (index, delta) => {
    const ids = categories.map((c) => c.id);
    const [id] = ids.splice(index, 1);
    ids.splice(index + delta, 0, id);
    move.mutate(ids);
  };

  const submitNew = (e) => {
    e.preventDefault();
    if (newName.trim()) add.mutate();
  };

  const mutationError = add.error || rename.error || move.error;

  return (
    <>
      <div className={ui.pageHead}>
        <div>
          <h1 className={ui.pageTitle}>Categorías</h1>
          <p className={ui.pageSub}>
            La tablet muestra las categorías en este orden. Las que no tienen productos disponibles no aparecen.
          </p>
        </div>
      </div>

      <form className={styles.addForm} onSubmit={submitNew}>
        <label className={ui.field} style={{ flex: 1 }}>
          <span className="visually-hidden">Nombre de la nueva categoría</span>
          <input
            className={ui.input}
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              add.reset();
            }}
            maxLength={60}
            placeholder="Nueva categoría, p. ej. Especiales de temporada"
          />
        </label>
        <button type="submit" className={`${ui.btn} ${ui.primary}`} disabled={!newName.trim() || add.isPending}>
          <PlusIcon />
          Agregar categoría
        </button>
      </form>

      {mutationError && (
        <p className={ui.alert} role="alert" style={{ marginBottom: 16 }}>
          {mutationError.message}
        </p>
      )}

      {categoriesQuery.isLoading && <div className={styles.skeleton} />}

      {categoriesQuery.isError && (
        <div className={`${ui.card} ${ui.empty}`}>
          <strong>No se pudieron cargar las categorías</strong>
          {categoriesQuery.error.message}
        </div>
      )}

      {categoriesQuery.isSuccess && categories.length === 0 && (
        <div className={`${ui.card} ${ui.empty}`}>
          <strong>Todavía no hay categorías</strong>
          Agrega la primera arriba, como Cafés calientes o Panadería.
        </div>
      )}

      {categories.length > 0 && (
        <ol className={`${ui.card} ${styles.list}`}>
          {categories.map((c, i) => {
            const count = counts.get(c.id) ?? { total: 0, available: 0 };
            const isEditing = editing?.id === c.id;
            return (
              <li key={c.id} className={styles.row}>
                <span className={styles.position}>{i + 1}</span>

                {isEditing ? (
                  <form
                    className={styles.renameForm}
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (editing.name.trim()) rename.mutate(editing);
                    }}
                  >
                    <input
                      className={ui.input}
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                      onKeyDown={(e) => e.key === "Escape" && setEditing(null)}
                      maxLength={60}
                      autoFocus
                      aria-label={`Nuevo nombre para ${c.name}`}
                    />
                    <button type="submit" className={`${ui.btn} ${ui.primary} ${ui.sm}`} disabled={rename.isPending}>
                      Guardar
                    </button>
                    <button type="button" className={`${ui.btn} ${ui.ghost} ${ui.sm}`} onClick={() => setEditing(null)}>
                      Cancelar
                    </button>
                  </form>
                ) : (
                  <div className={styles.info}>
                    <span className={styles.name}>{c.name}</span>
                    <span className={styles.meta}>
                      {count.total === 0
                        ? "Sin productos"
                        : `${plural(count.total, "producto", "productos")}${
                            count.available < count.total ? `, ${count.available} en la tablet` : ""
                          }`}
                    </span>
                  </div>
                )}

                {!isEditing && (
                  <div className={styles.actions}>
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.ghost} ${ui.sm} ${ui.iconOnly}`}
                      onClick={() => moveBy(i, -1)}
                      disabled={i === 0 || move.isPending}
                      aria-label={`Subir ${c.name}`}
                      title="Subir"
                    >
                      <ArrowUpIcon />
                    </button>
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.ghost} ${ui.sm} ${ui.iconOnly}`}
                      onClick={() => moveBy(i, 1)}
                      disabled={i === categories.length - 1 || move.isPending}
                      aria-label={`Bajar ${c.name}`}
                      title="Bajar"
                    >
                      <ArrowDownIcon />
                    </button>
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.secondary} ${ui.sm}`}
                      onClick={() => {
                        rename.reset();
                        setEditing({ id: c.id, name: c.name });
                      }}
                    >
                      <PencilIcon />
                      Renombrar
                    </button>
                    <button
                      type="button"
                      className={`${ui.btn} ${ui.dangerGhost} ${ui.sm} ${ui.iconOnly}`}
                      onClick={() => {
                        remove.reset();
                        setDeleting({ ...c, productCount: count.total });
                      }}
                      aria-label={`Eliminar ${c.name}`}
                      title="Eliminar"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `¿Eliminar ${deleting.name}?` : ""}
        confirmLabel="Eliminar categoría"
        onConfirm={() => remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
        busy={remove.isPending}
        confirmDisabled={deleting?.productCount > 0}
        error={remove.isError ? remove.error.message : null}
      >
        {deleting?.productCount > 0 ? (
          <p style={{ margin: 0 }}>
            {deleting.name} todavía tiene {plural(deleting.productCount, "producto", "productos")}. Primero muévelos a
            otra categoría o elimínalos en Productos.
          </p>
        ) : (
          <p style={{ margin: 0 }}>Esta categoría está vacía, así que no se afecta nada más.</p>
        )}
      </ConfirmDialog>
    </>
  );
}
