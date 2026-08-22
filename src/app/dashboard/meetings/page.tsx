"use client";

import React, { useState } from "react";
import { Card, CardBody } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/Dashboard/PageHeader";

interface Meeting {
  id: string;
  investorName: string;
  investorFirm: string;
  date: string;
  time: string;
  duration: string;
  type: "video" | "phone" | "in-person";
  status: "upcoming" | "completed" | "cancelled";
  notes?: string;
  fitScore: number;
}

const sampleMeetings: Meeting[] = [
  {
    id: "1",
    investorName: "Lisa Thompson",
    investorFirm: "Greylock Partners",
    date: "Tomorrow",
    time: "2:00 PM",
    duration: "30 min",
    type: "video",
    status: "upcoming",
    fitScore: 90,
    notes: "Discuss seed round and AI matching technology.",
  },
  {
    id: "2",
    investorName: "Sarah Chen",
    investorFirm: "Sequoia Capital",
    date: "Jan 28",
    time: "10:30 AM",
    duration: "45 min",
    type: "video",
    status: "upcoming",
    fitScore: 94,
    notes: "Pitch deck review and product demo.",
  },
  {
    id: "3",
    investorName: "James Liu",
    investorFirm: "Lightspeed VP",
    date: "Jan 20",
    time: "3:00 PM",
    duration: "30 min",
    type: "phone",
    status: "completed",
    fitScore: 87,
    notes: "Initial call — interested in AI infrastructure angle.",
  },
];

const typeIcons: Record<string, string> = {
  video: "ri-video-line",
  phone: "ri-phone-line",
  "in-person": "ri-map-pin-line",
};

export default function MeetingsPage() {
  const [filter, setFilter] = useState<"all" | "upcoming" | "completed">("all");

  const filtered = filter === "all" ? sampleMeetings : sampleMeetings.filter((m) => m.status === filter);
  const upcoming = sampleMeetings.filter((m) => m.status === "upcoming");

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Schedule and track investor meetings."
        actions={
          <Button>
            <i className="ri-calendar-line text-[18px]"></i>
            Schedule Meeting
          </Button>
        }
      />

      {/* Meeting Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-[15px] md:gap-[20px] mb-[25px]">
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-lime-100 dark:bg-lime-900/20 flex items-center justify-center text-lime-600 text-[20px] flex-none">
              <i className="ri-calendar-check-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Upcoming</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{upcoming.length}</p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 text-[20px] flex-none">
              <i className="ri-check-double-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Completed</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">
                {sampleMeetings.filter((m) => m.status === "completed").length}
              </p>
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="flex items-center gap-[14px]">
            <div className="w-[40px] h-[40px] rounded-[10px] bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 text-[20px] flex-none">
              <i className="ri-team-line"></i>
            </div>
            <div>
              <p className="text-[12px] text-gray-400 !mb-[2px]">Total Meetings</p>
              <p className="text-[20px] font-bold text-[#06201b] dark:text-white !mb-0">{sampleMeetings.length}</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-[8px] mb-[20px]">
        {(["all", "upcoming", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-[14px] py-[6px] rounded-full text-[13px] font-medium transition-all ${
              filter === f
                ? "bg-[#06201b] text-white dark:bg-lime-500 dark:text-black"
                : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Meeting List */}
      {filtered.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<i className="ri-calendar-line"></i>}
              title="No meetings yet"
              description="When investors express interest, you can schedule meetings. AI will prepare meeting briefs for you."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="space-y-[12px]">
          {filtered.map((meeting) => (
            <Card key={meeting.id} className="hover:shadow-md transition-shadow">
              <CardBody>
                <div className="flex flex-col sm:flex-row sm:items-center gap-[14px]">
                  {/* Date Block */}
                  <div className="w-[56px] h-[56px] rounded-[12px] bg-lime-50 dark:bg-lime-900/20 flex flex-col items-center justify-center flex-none">
                    <span className="text-[18px] font-bold text-[#06201b] dark:text-white leading-none">
                      {meeting.date === "Tomorrow" ? new Date().getDate() + 1 : parseInt(meeting.date.split(" ")[1]) || 0}
                    </span>
                    <span className="text-[10px] font-medium text-gray-400 uppercase">
                      {meeting.date === "Tomorrow" ? "TMR" : meeting.date.split(" ")[0]?.slice(0, 3) || ""}
                    </span>
                  </div>

                  {/* Meeting Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-[8px] mb-[2px]">
                      <h3 className="text-[14px] font-semibold text-[#06201b] dark:text-white !mb-0 truncate">
                        {meeting.investorName}
                      </h3>
                      <Badge variant={meeting.status === "upcoming" ? "success" : "info"} size="sm">
                        {meeting.status === "upcoming" ? "Upcoming" : "Completed"}
                      </Badge>
                    </div>
                    <p className="text-[12px] text-gray-400 !mb-[4px]">{meeting.investorFirm}</p>
                    <div className="flex items-center gap-[12px] text-[12px] text-gray-400">
                      <span><i className={`${typeIcons[meeting.type]} mr-[4px]`}></i>{meeting.type === "in-person" ? "In Person" : meeting.type.charAt(0).toUpperCase() + meeting.type.slice(1)}</span>
                      <span><i className="ri-time-line mr-[4px]"></i>{meeting.time}</span>
                      <span><i className="ri-timer-line mr-[4px]"></i>{meeting.duration}</span>
                    </div>
                    {meeting.notes && (
                      <p className="text-[12px] text-gray-400 !mb-0 mt-[6px] italic">"{meeting.notes}"</p>
                    )}
                  </div>

                  {/* Fit Score + Actions */}
                  <div className="flex items-center gap-[12px] sm:flex-shrink-0">
                    <div className="text-center">
                      <p className={`text-[16px] font-bold !mb-0 ${meeting.fitScore >= 90 ? "text-green-600" : "text-amber-600"}`}>
                        {meeting.fitScore}%
                      </p>
                      <p className="text-[10px] text-gray-400 !mb-0">Fit</p>
                    </div>
                    {meeting.status === "upcoming" && (
                      <Button size="sm">
                        <i className="ri-video-line text-[14px]"></i>
                        Join
                      </Button>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
