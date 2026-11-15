import Sidebar from "@/components/dashboard/Sidebar";
import styles from "./dashboard.module.css";

export const metadata = {
  title: "Panel · Coffee Palace",
};

export default function DashboardLayout({ children }) {
  return (
    <div className={styles.shell}>
      <Sidebar />
      <main className={styles.content}>{children}</main>
    </div>
  );
}
