"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useId, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { imageSrc } from "@/lib/api/client";
import {
  createProduct,
  deleteProductImage,
  productKeys,
  updateProduct,
  uploadProductImage,
} from "@/lib/api/products";
import Modal from "@/components/ui/Modal";
import Toggle from "@/components/dashboard/Toggle";
import { CameraIcon, TrashIcon } from "@/components/ui/Icons";
import { config } from "@/lib/config";
import { useExchangeRate } from "@/hooks/useExchangeRate";
import { formatBs, formatRate, parsePrice, priceInputValue, toBs } from "@/lib/format";
import { resizeImage } from "@/lib/resizeImage";
import ui from "./dash.module.css";
import styles from "./ProductForm.module.css";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export default function ProductForm({ product, categories, defaultCategoryId, onClose }) {
  const queryClient = useQueryClient();
  const { rate } = useExchangeRate();
  const formId = useId();
  const fileInput = useRef(null);
  const createdId = useRef(null);

  const [fields, setFields] = useState(() => ({
    name: product?.name ?? "",
    categoryId: String(product?.categoryId ?? defaultCategoryId ?? categories[0]?.id ?? ""),
    price: priceInputValue(product?.priceUsd),
    description: product?.description ?? "",
    isAvailable: product?.isAvailable ?? true,
  }));
  const [photo, setPhoto] = useState({ file: null, preview: null, removed: false });
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [touched, setTouched] = useState(false);

  // Release the preview URL when it changes or the form closes
  useEffect(() => {
    const url = photo.preview;
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [photo.preview]);

  const set = (key) => (e) => setFields((f) => ({ ...f, [key]: e.target.value }));

  const price = parsePrice(fields.price);
  const errors = {
    name: !fields.name.trim() ? "Ponle un nombre al producto." : "",
    categoryId: !fields.categoryId ? "Elige una categoría." : "",
    price: Number.isNaN(price) ? "Escribe un precio en dólares como 4,75 o déjalo vacío." : "",
  };
  const invalid = Object.values(errors).some(Boolean);

  const pickFile = async (file) => {
    setPhotoError("");
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      setPhotoError("Usa una foto JPG, PNG, WebP o GIF.");
      return;
    }
    if (file.size > config.maxPhotoUploadMb * 1024 * 1024) {
      setPhotoError(`Esa foto pesa más de ${config.maxPhotoUploadMb} MB. Prueba con una más pequeña.`);
      return;
    }
    setPhotoBusy(true);
    try {
      const resized = await resizeImage(file, config.photoMaxSidePx);
      setPhoto({ file: resized, preview: URL.createObjectURL(resized), removed: false });
    } catch {
      setPhotoError("No se pudo abrir esa foto. Prueba con otro archivo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = () => {
    setPhoto({ file: null, preview: null, removed: true });
    setPhotoError("");
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: fields.name.trim(),
        categoryId: Number(fields.categoryId),
        priceUsd: price,
        description: fields.description.trim(),
        isAvailable: fields.isAvailable,
      };
      const id = product?.id ?? createdId.current;
      let saved = id ? await updateProduct(id, payload) : await createProduct(payload);
      createdId.current = saved.id;

      try {
        if (photo.file) {
          saved = await uploadProductImage(saved.id, photo.file);
        } else if (photo.removed && saved.imageUrl) {
          saved = await deleteProductImage(saved.id);
        }
      } catch (err) {
        err.photoFailed = true; // the product itself was saved
        throw err;
      }
      return saved;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productKeys.all });
      onClose();
    },
    onError: () => {
      if (createdId.current) queryClient.invalidateQueries({ queryKey: productKeys.all });
    },
  });

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!invalid) save.mutate();
  };

  const currentSrc = photo.preview ?? (!photo.removed ? imageSrc(product?.imageUrl) : null);
  const show = (key) => touched && errors[key];

  return (
    <Modal
      open
      onClose={save.isPending ? undefined : onClose}
      title={product ? `Editar ${product.name}` : "Agregar producto"}
      size="lg"
      footer={
        <>
          <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={onClose} disabled={save.isPending}>
            Cancelar
          </button>
          <button
            type="submit"
            form={formId}
            className={`${ui.btn} ${ui.primary}`}
            disabled={save.isPending || photoBusy}
          >
            {save.isPending ? "Guardando…" : product ? "Guardar cambios" : "Agregar producto"}
          </button>
        </>
      }
    >
      <form id={formId} className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.photoCol}>
          <span className={ui.label}>
            Foto <span className={ui.optional}>(opcional)</span>
          </span>
          <div
            className={`${styles.drop} ${dragging ? styles.dragging : ""} ${currentSrc ? styles.hasPhoto : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
          >
            {currentSrc ? (
              <img src={currentSrc} alt={`Foto de ${fields.name || "el producto"}`} />
            ) : (
              <button type="button" className={styles.dropEmpty} onClick={() => fileInput.current?.click()}>
                <CameraIcon />
                <span>{photoBusy ? "Preparando foto…" : "Arrastra una foto aquí o elige una"}</span>
                <span className={styles.dropHelp}>Sin foto, la tablet muestra el nombre del producto.</span>
              </button>
            )}
          </div>

          <input
            ref={fileInput}
            type="file"
            accept={ACCEPT}
            className="visually-hidden"
            tabIndex={-1}
            onChange={(e) => {
              pickFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />

          {currentSrc && (
            <div className={styles.photoActions}>
              <button
                type="button"
                className={`${ui.btn} ${ui.secondary} ${ui.sm}`}
                onClick={() => fileInput.current?.click()}
                disabled={photoBusy}
              >
                <CameraIcon />
                {photoBusy ? "Preparando…" : "Cambiar foto"}
              </button>
              <button type="button" className={`${ui.btn} ${ui.dangerGhost} ${ui.sm}`} onClick={removePhoto}>
                <TrashIcon />
                Quitar
              </button>
            </div>
          )}
          {photoError && <span className={ui.errorText}>{photoError}</span>}
        </div>

        <div className={styles.fieldsCol}>
          <label className={ui.field}>
            <span className={ui.label}>Nombre</span>
            <input
              className={`${ui.input} ${show("name") ? ui.inputError : ""}`}
              value={fields.name}
              onChange={set("name")}
              maxLength={80}
              placeholder="p. ej. Latte de vainilla"
              autoFocus
            />
            {show("name") && <span className={ui.errorText}>{errors.name}</span>}
          </label>

          <div className={styles.row}>
            <label className={ui.field}>
              <span className={ui.label}>Categoría</span>
              <select
                className={`${ui.select} ${show("categoryId") ? ui.inputError : ""}`}
                value={fields.categoryId}
                onChange={set("categoryId")}
              >
                {categories.length === 0 && <option value="">Primero agrega una categoría</option>}
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              {show("categoryId") && <span className={ui.errorText}>{errors.categoryId}</span>}
            </label>

            {config.showPrices && (
              <label className={ui.field}>
                <span className={ui.label}>
                  Precio en dólares <span className={ui.optional}>(opcional)</span>
                </span>
                <span className={styles.priceWrap}>
                  <span className={styles.currency}>{config.usdSymbol}</span>
                  <input
                    className={`${ui.input} ${styles.priceInput} ${show("price") ? ui.inputError : ""}`}
                    value={fields.price}
                    onChange={set("price")}
                    inputMode="decimal"
                    placeholder="0,00"
                  />
                </span>
                {show("price") ? (
                  <span className={ui.errorText}>{errors.price}</span>
                ) : (
                  <span className={ui.help}>
                    {!price
                      ? "Los bolívares se calculan con la tasa BCV."
                      : rate
                        ? `${formatBs(toBs(price, rate))} a ${formatRate(rate)} Bs./$`
                        : "Sin tasa BCV todavía: se mostrará solo en dólares."}
                  </span>
                )}
              </label>
            )}
          </div>

          <label className={ui.field}>
            <span className={ui.label}>
              Descripción <span className={ui.optional}>(opcional)</span>
            </span>
            <textarea
              className={ui.textarea}
              value={fields.description}
              onChange={set("description")}
              maxLength={200}
              rows={3}
              placeholder="Una frase corta que los clientes ven en la tablet"
            />
            <span className={ui.help}>{fields.description.length}/200</span>
          </label>

          <div className={styles.availability}>
            <Toggle
              checked={fields.isAvailable}
              onChange={(v) => setFields((f) => ({ ...f, isAvailable: v }))}
              label={fields.isAvailable ? "Visible en la tablet" : "Oculto en la tablet"}
            />
          </div>

          {save.isError && (
            <p className={ui.alert} role="alert">
              {save.error.photoFailed
                ? `El producto se guardó, pero la foto no se actualizó. ${save.error.message}`
                : `No se pudo guardar. ${save.error.message}`}
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
