"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { addInvestorToList, removeInvestorFromList } from "@/lib/actions/investor-lists";

export interface ListMember {
  itemId: string;
  investorId: string;
  name: string;
  firm: string | null;
  email: string | null;
  note: string | null;
}

interface SearchResult {
  id: string;
  full_name: string;
  job_title?: string | null;
  country?: string | null;
}

export default function ListMembers({
  listId,
  members,
}: {
  listId: string;
  members: ListMember[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/investors?search=${encodeURIComponent(term)}&limit=8&sortBy=fit_score&sortDir=desc`
      );
      const data = await res.json();
      setResults(Array.isArray(data.investors) ? data.investors : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const add = (investor: SearchResult) => {
    setError(null);
    startTransition(async () => {
      const result = await addInvestorToList({ listId, investorId: investor.id });
      if (!result.ok) setError(result.error ?? "Could not add the investor.");
      setResults((prev) => prev.filter((r) => r.id !== investor.id));
      router.refresh();
    });
  };

  return (
    <div>
      <Card className="mb-[18px]">
        <CardBody>
          <label className="block text-[12px] font-medium text-gray-500 mb-[6px]">
            Add an investor to this list
          </label>
          <div className="flex gap-[8px] flex-wrap">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void search();
                }
              }}
              placeholder="Search by name, firm or thesis"
              className="flex-1 min-w-[220px] rounded-[8px] border border-gray-200 bg-white px-[12px] py-[9px] text-[14px] text-[#06201b] outline-none focus:border-lime-500 dark:border-gray-700 dark:bg-gray-900 dark:text-white"
            />
            <Button size="sm" variant="outline" onClick={search} loading={searching}>
              Search
            </Button>
          </div>
          {error && (
            <p className="text-[12px] text-red-600 mt-[8px] !mb-0">{error}</p>
          )}
          {results.length > 0 && (
            <ul className="mt-[10px] divide-y divide-gray-100 dark:divide-gray-800">
              {results.map((result) => (
                <li key={result.id} className="flex items-center gap-[10px] py-[8px]">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-[#06201b] dark:text-white !mb-0 truncate">
                      {result.full_name}
                    </p>
                    <p className="text-[11px] text-gray-400 !mb-0 truncate">
                      {[result.job_title, result.country].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => add(result)} loading={pending}>
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {members.length === 0 ? (
        <Card>
          <CardBody>
            <p className="text-[13px] text-gray-500 !mb-0">
              This list is empty. Search above to add the first investor.
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[10px]">
          {members.map((member) => (
            <Card key={member.itemId}>
              <CardBody className="flex items-center gap-[12px]">
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/dashboard/investors/${member.investorId}`}
                    className="text-[14px] font-medium text-[#06201b] dark:text-white hover:text-lime-600"
                  >
                    {member.name}
                  </Link>
                  <p className="text-[12px] text-gray-400 !mb-0">
                    {[member.firm, member.email].filter(Boolean).join(" · ") || "No firm or email on file"}
                  </p>
                  {member.note && (
                    <p className="text-[12px] text-gray-500 !mb-0 mt-[4px]">{member.note}</p>
                  )}
                </div>
                <button
                  onClick={() =>
                    startTransition(async () => {
                      const result = await removeInvestorFromList(member.itemId);
                      if (!result.ok) setError(result.error ?? "Could not remove.");
                      router.refresh();
                    })
                  }
                  className="text-gray-400 hover:text-red-500 px-[6px] py-[4px] flex-none"
                  title="Remove from list"
                >
                  <i className="ri-close-line text-[18px]"></i>
                </button>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
