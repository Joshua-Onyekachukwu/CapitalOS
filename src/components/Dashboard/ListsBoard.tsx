"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createInvestorList, deleteInvestorList } from "@/lib/actions/investor-lists";

export interface InvestorListSummary {
  id: string;
  name: string;
  description: string | null;
  itemCount: number;
  createdAt: string;
}

export default function ListsBoard({ lists }: { lists: InvestorListSummary[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createInvestorList(form);
      if (!result.ok) {
        setError(result.error ?? "Could not create the list.");
        return;
      }
      setForm({ name: "", description: "" });
      setShowForm(false);
      router.refresh();
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-[14px] gap-[10px] flex-wrap">
        <p className="text-[13px] text-gray-500 !mb-0">
          Curated groups of investors you can work as a batch. {lists.length} lists.
        </p>
        <Button size="sm" onClick={() => setShowForm((v) => !v)}>
          <i className="ri-add-line text-[16px]"></i>
          {showForm ? "Close" : "New list"}
        </Button>
      </div>

      {error && (
        <div className="mb-[12px] rounded-[8px] border border-red-300 bg-red-50 px-[12px] py-[8px] text-[13px] text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          <i className="ri-error-warning-line mr-[6px]"></i>
          {error}
        </div>
      )}

      {showForm && (
        <Card className="mb-[16px]">
          <CardBody>
            <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-[10px]">
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="List name *"
                maxLength={120}
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What this list is for"
                className="rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
              />
              <div className="sm:col-span-2">
                <Button type="submit" size="sm" loading={pending} disabled={!form.name.trim()}>
                  Create list
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {lists.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[13px] text-gray-500 !mb-0">
              No lists yet. Create one for a thesis, a geography or a stage, then add investors
              from the database.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
          {lists.map((list) => (
            <Card key={list.id} className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex items-start justify-between gap-[10px]">
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/lists/${list.id}`}
                      className="text-[15px] font-semibold text-[#06201b] dark:text-white hover:text-lime-600"
                    >
                      {list.name}
                    </Link>
                    <p className="text-[12px] text-gray-400 !mb-0">
                      {list.itemCount} investor{list.itemCount === 1 ? "" : "s"} ·{" "}
                      {new Date(list.createdAt).toLocaleDateString()}
                    </p>
                    {list.description && (
                      <p className="text-[12px] text-gray-500 !mb-0 mt-[6px]">
                        {list.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() =>
                      startTransition(async () => {
                        const result = await deleteInvestorList(list.id);
                        if (!result.ok) setError(result.error ?? "Could not delete the list.");
                        router.refresh();
                      })
                    }
                    className="text-gray-300 hover:text-red-500 px-[4px] py-[2px] flex-none"
                    title="Delete list"
                  >
                    <i className="ri-delete-bin-line text-[16px]"></i>
                  </button>
                </div>
                <Link
                  href={`/dashboard/lists/${list.id}`}
                  className="inline-flex items-center gap-[6px] text-[12px] font-medium text-lime-600 hover:underline mt-[12px]"
                >
                  Open list
                  <i className="ri-arrow-right-line"></i>
                </Link>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
