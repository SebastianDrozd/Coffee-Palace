"use client";

/* eslint-disable @next/next/no-img-element */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { categoryKeys, getCategories } from "@/lib/api/categories";
import { imageSrc } from "@/lib/api/client";
import { deleteProduct, getProducts, productKeys, updateProduct } from "@/lib/api/products";
import ConfirmDialog from "@/components/dashboard/ConfirmDialog";
import ProductForm from "@/components/dashboard/ProductForm";
import Toggle from "@/components/dashboard/Toggle";
import { CameraIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/ui/Icons";
import { config } from "@/lib/config";
import { formatBs, formatUsd, hasPrice, plural, toBs } from "@/lib/format";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import ui from "@/components/dashboard/dash.module.css";
import styles from "./products.module.css";

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const categoriesQuery = useQuery({ queryKey: categoryKeys.all, queryFn: getCategories });
  const productsQuery = useQuery({ queryKey: productKeys.all, queryFn: getProducts });
  const { rate } = useExchangeRate();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [form, setForm] = useState(null); // { product, defaultCategoryId }
  const [deleting, setDeleting] = useState(null);

  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data]);
  const products = useMemo(() => productsQuery.data ?? [], [productsQuery.data]);

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    return categories
      .filter((c) => filter === "all" || String(c.id) === filter)
      .map((c) => ({
        ...c,
        products: products.filter(
          (p) =>
            p.categoryId === c.id &&
            (!term || p.name.toLowerCase().includes(term) || p.description?.toLowerCase().includes(term))
        ),
      }))
      .filter((g) => g.products.length > 0 || (!term && filter !== "all"));
  }, [categories, products, search, filter]);

  const availability = useMutation({
    mutationFn: (product) => updateProduct(product.id, { ...product, isAvailable: !product.isAvailable }),
    onMutate: async (product) => {
      await queryClient.cancelQueries({ queryKey: productKeys.all });
      const previous = queryClient.getQueryData(productKeys.all);
      queryClient.setQueryData(productKeys.all, (list = []) =>
        list.map((p) => (p.id === product.id ? { ...p, isAvailable: !p.isAvailable } : p))
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => ctx?.previous && queryClient.setQueryData(productKeys.all, ctx.previous),
    onSettled: () => queryClient.invalidateQueries({ queryKey: productKeys.all }),
  });

  const remove = useMutation({
    mutationFn: (product) => deleteProduct(product.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      setDeleting(null);
    },
  });

  const loading = categoriesQuery.isLoading || productsQuery.isLoading;
  const loadError = categoriesQuery.error || productsQuery.error;
  const hiddenCount = products.filter((p) => !p.isAvailable).length;

  return (
    <>
      <div className={ui.pageHead}>
        <div>
          <h1 className={ui.pageTitle}>Productos</h1>
          <p className={ui.pageSub}>
            {loading
              ? "Cargando productos…"
              : `${plural(products.length, "producto", "productos")}${
                  hiddenCount ? `, ${plural(hiddenCount, "oculto", "ocultos")} en la tablet` : ""
                }`}
          </p>
        </div>
        <div className={ui.headActions}>
          <button
            type="button"
            className={`${ui.btn} ${ui.primary}`}
            onClick={() => setForm({ product: null, defaultCategoryId: filter !== "all" ? Number(filter) : undefined })}
            disabled={categories.length === 0}
          >
            <PlusIcon />
            Agregar producto
          </button>
        </div>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <SearchIcon />
          <span className="visually-hidden">Buscar productos</span>
          <input
            className={ui.input}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar productos"
          />
        </label>
        <div className={styles.chips} role="group" aria-label="Filtrar por categoría">
          <button
            type="button"
            className={filter === "all" ? styles.chipOn : styles.chip}
            aria-pressed={filter === "all"}
            onClick={() => setFilter("all")}
          >
            Todos
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={filter === String(c.id) ? styles.chipOn : styles.chip}
              aria-pressed={filter === String(c.id)}
              onClick={() => setFilter(String(c.id))}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      {availability.isError && (
        <p className={ui.alert} role="alert" style={{ marginBottom: 16 }}>
          No se pudo cambiar la disponibilidad. {availability.error.message}
        </p>
      )}

      {loading && <div className={styles.skeleton} />}

      {loadError && !loading && (
        <div className={`${ui.card} ${ui.empty}`}>
          <strong>No se pudieron cargar los productos</strong>
          {loadError.message}
        </div>
      )}

      {!loading && !loadError && categories.length === 0 && (
        <div className={`${ui.card} ${ui.empty}`}>
          <strong>Empieza con una categoría</strong>
          Los productos se organizan en categorías como Cafés calientes o Panadería.
          <div style={{ marginTop: 16 }}>
            <Link href="/dashboard/categories" className={`${ui.btn} ${ui.primary}`}>
              Agregar una categoría
            </Link>
          </div>
        </div>
      )}

      {!loading && !loadError && categories.length > 0 && groups.length === 0 && (
        <div className={`${ui.card} ${ui.empty}`}>
          <strong>Ningún producto coincide con “{search}”</strong>
          Prueba con otro nombre o borra la búsqueda.
        </div>
      )}

      <div className={styles.groups}>
        {groups.map((group) => (
          <section key={group.id} className={`${ui.card} ${styles.group}`} aria-labelledby={`grp-${group.id}`}>
            <header className={styles.groupHead}>
              <h2 id={`grp-${group.id}`}>{group.name}</h2>
              <span className={styles.groupCount}>{group.products.length}</span>
              <button
                type="button"
                className={`${ui.btn} ${ui.ghost} ${ui.sm}`}
                onClick={() => setForm({ product: null, defaultCategoryId: group.id })}
              >
                <PlusIcon />
                Agregar a {group.name}
              </button>
            </header>

            {group.products.length === 0 ? (
              <p className={styles.groupEmpty}>Todavía no hay productos en esta categoría.</p>
            ) : (
              <ul className={styles.rows}>
                {group.products.map((p) => {
                  const src = imageSrc(p.imageUrl);
                  return (
                    <li key={p.id} className={`${styles.row} ${!p.isAvailable ? styles.hidden : ""}`}>
                      <button
                        type="button"
                        className={styles.thumb}
                        onClick={() => setForm({ product: p })}
                        aria-label={src ? `Cambiar la foto de ${p.name}` : `Agregar una foto de ${p.name}`}
                      >
                        {src ? (
                          <img src={src} alt="" />
                        ) : (
                          <span className={styles.noPhoto}>
                            <CameraIcon />
                            <span>Agregar foto</span>
                          </span>
                        )}
                      </button>

                      <div className={styles.info}>
                        <span className={styles.name}>{p.name}</span>
                        {p.description && <span className={styles.desc}>{p.description}</span>}
                      </div>

                      <span className={styles.price}>
                        {config.showPrices &&
                          (hasPrice(p.priceUsd) ? (
                            <>
                              {formatUsd(p.priceUsd)}
                              {rate && <span className={styles.priceBs}>{formatBs(toBs(p.priceUsd, rate))}</span>}
                            </>
                          ) : (
                            "—"
                          ))}
                      </span>

                      <div className={styles.avail}>
                        <Toggle
                          checked={p.isAvailable}
                          onChange={() => availability.mutate(p)}
                          label={p.isAvailable ? "En la tablet" : "Oculto"}
                        />
                      </div>

                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={`${ui.btn} ${ui.secondary} ${ui.sm}`}
                          onClick={() => setForm({ product: p })}
                        >
                          <PencilIcon />
                          Editar
                        </button>
                        <button
                          type="button"
                          className={`${ui.btn} ${ui.dangerGhost} ${ui.sm} ${ui.iconOnly}`}
                          onClick={() => {
                            remove.reset();
                            setDeleting(p);
                          }}
                          aria-label={`Eliminar ${p.name}`}
                          title="Eliminar"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>

      {form && (
        <ProductForm
          key={form.product?.id ?? "new"}
          product={form.product}
          categories={categories}
          defaultCategoryId={form.defaultCategoryId}
          onClose={() => setForm(null)}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={deleting ? `¿Eliminar ${deleting.name}?` : ""}
        confirmLabel="Eliminar producto"
        onConfirm={() => remove.mutate(deleting)}
        onCancel={() => setDeleting(null)}
        busy={remove.isPending}
        error={remove.isError ? `No se pudo eliminar. ${remove.error.message}` : null}
      >
        <p style={{ margin: 0 }}>
          Sale del menú de la tablet de inmediato. Los pedidos anteriores conservan sus datos. Si solo quieres
          quitarlo por un tiempo, desactiva <strong>En la tablet</strong>.
        </p>
      </ConfirmDialog>
    </>
  );
}
