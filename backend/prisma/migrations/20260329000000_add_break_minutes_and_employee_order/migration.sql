-- AlterTable
ALTER TABLE "Shift" ADD COLUMN "breakMinutes" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ScheduleEmployeeOrder" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScheduleEmployeeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleEmployeeOrder_scheduleId_employeeId_key" ON "ScheduleEmployeeOrder"("scheduleId", "employeeId");

-- AddForeignKey
ALTER TABLE "ScheduleEmployeeOrder" ADD CONSTRAINT "ScheduleEmployeeOrder_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleEmployeeOrder" ADD CONSTRAINT "ScheduleEmployeeOrder_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
