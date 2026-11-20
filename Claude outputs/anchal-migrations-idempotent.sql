DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'commissioner_monitoring') THEN
        CREATE SCHEMA commissioner_monitoring;
    END IF;
END $EF$;
CREATE TABLE IF NOT EXISTS commissioner_monitoring.__monitoring_ef_migrations_history (
    "MigrationId" character varying(150) NOT NULL,
    "ProductVersion" character varying(32) NOT NULL,
    CONSTRAINT "PK___monitoring_ef_migrations_history" PRIMARY KEY ("MigrationId")
);

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
        IF NOT EXISTS(SELECT 1 FROM pg_namespace WHERE nspname = 'commissioner_monitoring') THEN
            CREATE SCHEMA commissioner_monitoring;
        END IF;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_catalog_items (
        "Id" uuid NOT NULL,
        "Kind" character varying(20) NOT NULL,
        "Key" character varying(80) NOT NULL,
        "Name" character varying(160) NOT NULL,
        "SortOrder" integer NOT NULL,
        "IsActive" boolean NOT NULL,
        CONSTRAINT "PK_monitoring_catalog_items" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_offices (
        "Id" uuid NOT NULL,
        "Code" character varying(40) NOT NULL,
        "Name" character varying(160) NOT NULL,
        "IsActive" boolean NOT NULL,
        CONSTRAINT "PK_monitoring_offices" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_users (
        "Id" uuid NOT NULL,
        "LoginName" character varying(120) NOT NULL,
        "NormalizedLoginName" character varying(120) NOT NULL,
        "PasswordHash" character varying(512) NOT NULL,
        "DisplayName" character varying(160) NOT NULL,
        "Role" character varying(40) NOT NULL,
        "IsActive" boolean NOT NULL,
        "CreatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_monitoring_users" PRIMARY KEY ("Id")
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_audit_events (
        "Id" uuid NOT NULL,
        "OfficeId" uuid NOT NULL,
        "ActorUserId" uuid,
        "AggregateType" character varying(80) NOT NULL,
        "AggregateId" uuid NOT NULL,
        "Action" character varying(80) NOT NULL,
        "BeforeJson" jsonb NOT NULL,
        "AfterJson" jsonb NOT NULL,
        "OccurredAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_monitoring_audit_events" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_monitoring_audit_events_monitoring_offices_OfficeId" FOREIGN KEY ("OfficeId") REFERENCES commissioner_monitoring.monitoring_offices ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_monitoring_audit_events_monitoring_users_ActorUserId" FOREIGN KEY ("ActorUserId") REFERENCES commissioner_monitoring.monitoring_users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_office_setups (
        "Id" uuid NOT NULL,
        "OfficeId" uuid NOT NULL,
        "LockedByUserId" uuid NOT NULL,
        "EffectiveDate" date NOT NULL,
        "LockedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_monitoring_office_setups" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_monitoring_office_setups_monitoring_offices_OfficeId" FOREIGN KEY ("OfficeId") REFERENCES commissioner_monitoring.monitoring_offices ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_monitoring_office_setups_monitoring_users_LockedByUserId" FOREIGN KEY ("LockedByUserId") REFERENCES commissioner_monitoring.monitoring_users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_reports (
        "Id" uuid NOT NULL,
        "OfficeId" uuid NOT NULL,
        "ReportingDate" date NOT NULL,
        "IsZeroActivity" boolean NOT NULL,
        "SubmittedByUserId" uuid NOT NULL,
        "SubmittedAt" timestamp with time zone NOT NULL,
        "UpdatedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_monitoring_reports" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_monitoring_reports_monitoring_offices_OfficeId" FOREIGN KEY ("OfficeId") REFERENCES commissioner_monitoring.monitoring_offices ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_monitoring_reports_monitoring_users_SubmittedByUserId" FOREIGN KEY ("SubmittedByUserId") REFERENCES commissioner_monitoring.monitoring_users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_user_offices (
        "UserId" uuid NOT NULL,
        "OfficeId" uuid NOT NULL,
        "AssignedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_monitoring_user_offices" PRIMARY KEY ("UserId", "OfficeId"),
        CONSTRAINT "FK_monitoring_user_offices_monitoring_offices_OfficeId" FOREIGN KEY ("OfficeId") REFERENCES commissioner_monitoring.monitoring_offices ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_monitoring_user_offices_monitoring_users_UserId" FOREIGN KEY ("UserId") REFERENCES commissioner_monitoring.monitoring_users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_opening_balances (
        "Id" uuid NOT NULL,
        "OfficeSetupId" uuid NOT NULL,
        "Kind" character varying(20) NOT NULL,
        "ItemKey" character varying(80) NOT NULL,
        "Count" integer NOT NULL,
        CONSTRAINT "PK_monitoring_opening_balances" PRIMARY KEY ("Id"),
        CONSTRAINT ck_monitoring_opening_balance_nonnegative CHECK ("Count" >= 0),
        CONSTRAINT "FK_monitoring_opening_balances_monitoring_office_setups_Office~" FOREIGN KEY ("OfficeSetupId") REFERENCES commissioner_monitoring.monitoring_office_setups ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_report_entries (
        "Id" uuid NOT NULL,
        "ReportId" uuid NOT NULL,
        "Kind" character varying(20) NOT NULL,
        "ItemKey" character varying(80) NOT NULL,
        "ReceivedCount" integer NOT NULL,
        "DisposedCount" integer NOT NULL,
        "ClosingBalance" integer NOT NULL,
        CONSTRAINT "PK_monitoring_report_entries" PRIMARY KEY ("Id"),
        CONSTRAINT ck_monitoring_closing_nonnegative CHECK ("ClosingBalance" >= 0),
        CONSTRAINT ck_monitoring_disposed_nonnegative CHECK ("DisposedCount" >= 0),
        CONSTRAINT ck_monitoring_received_nonnegative CHECK ("ReceivedCount" >= 0),
        CONSTRAINT "FK_monitoring_report_entries_monitoring_reports_ReportId" FOREIGN KEY ("ReportId") REFERENCES commissioner_monitoring.monitoring_reports ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE TABLE commissioner_monitoring.monitoring_corrections (
        "Id" uuid NOT NULL,
        "ReportId" uuid NOT NULL,
        "EntryId" uuid,
        "CorrectedByUserId" uuid NOT NULL,
        "Reason" character varying(1000) NOT NULL,
        "BeforeJson" jsonb NOT NULL,
        "AfterJson" jsonb NOT NULL,
        "CorrectedAt" timestamp with time zone NOT NULL,
        CONSTRAINT "PK_monitoring_corrections" PRIMARY KEY ("Id"),
        CONSTRAINT "FK_monitoring_corrections_monitoring_report_entries_EntryId" FOREIGN KEY ("EntryId") REFERENCES commissioner_monitoring.monitoring_report_entries ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_monitoring_corrections_monitoring_reports_ReportId" FOREIGN KEY ("ReportId") REFERENCES commissioner_monitoring.monitoring_reports ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_monitoring_corrections_monitoring_users_CorrectedByUserId" FOREIGN KEY ("CorrectedByUserId") REFERENCES commissioner_monitoring.monitoring_users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_audit_events_ActorUserId" ON commissioner_monitoring.monitoring_audit_events ("ActorUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_audit_events_AggregateType_AggregateId" ON commissioner_monitoring.monitoring_audit_events ("AggregateType", "AggregateId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_audit_events_OfficeId_OccurredAt" ON commissioner_monitoring.monitoring_audit_events ("OfficeId", "OccurredAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE UNIQUE INDEX "IX_monitoring_catalog_items_Kind_Key" ON commissioner_monitoring.monitoring_catalog_items ("Kind", "Key");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_corrections_CorrectedByUserId" ON commissioner_monitoring.monitoring_corrections ("CorrectedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_corrections_EntryId" ON commissioner_monitoring.monitoring_corrections ("EntryId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_corrections_ReportId_CorrectedAt" ON commissioner_monitoring.monitoring_corrections ("ReportId", "CorrectedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_office_setups_LockedByUserId" ON commissioner_monitoring.monitoring_office_setups ("LockedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE UNIQUE INDEX "IX_monitoring_office_setups_OfficeId" ON commissioner_monitoring.monitoring_office_setups ("OfficeId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE UNIQUE INDEX "IX_monitoring_offices_Code" ON commissioner_monitoring.monitoring_offices ("Code");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE UNIQUE INDEX "IX_monitoring_opening_balances_OfficeSetupId_Kind_ItemKey" ON commissioner_monitoring.monitoring_opening_balances ("OfficeSetupId", "Kind", "ItemKey");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE UNIQUE INDEX "IX_monitoring_report_entries_ReportId_Kind_ItemKey" ON commissioner_monitoring.monitoring_report_entries ("ReportId", "Kind", "ItemKey");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE UNIQUE INDEX "IX_monitoring_reports_OfficeId_ReportingDate" ON commissioner_monitoring.monitoring_reports ("OfficeId", "ReportingDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_reports_SubmittedByUserId" ON commissioner_monitoring.monitoring_reports ("SubmittedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_reports_UpdatedAt" ON commissioner_monitoring.monitoring_reports ("UpdatedAt");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE INDEX "IX_monitoring_user_offices_OfficeId" ON commissioner_monitoring.monitoring_user_offices ("OfficeId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE UNIQUE INDEX "IX_monitoring_users_NormalizedLoginName" ON commissioner_monitoring.monitoring_users ("NormalizedLoginName");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    CREATE FUNCTION commissioner_monitoring.reject_immutable_monitoring_change()
    RETURNS trigger LANGUAGE plpgsql AS $monitoring$
    BEGIN
        RAISE EXCEPTION 'Monitoring audit, correction, and locked setup records are immutable';
        RETURN OLD;
    END;
    $monitoring$;

    CREATE TRIGGER monitoring_audit_events_immutable
    BEFORE UPDATE OR DELETE ON commissioner_monitoring.monitoring_audit_events
    FOR EACH ROW EXECUTE FUNCTION commissioner_monitoring.reject_immutable_monitoring_change();

    CREATE TRIGGER monitoring_corrections_immutable
    BEFORE UPDATE OR DELETE ON commissioner_monitoring.monitoring_corrections
    FOR EACH ROW EXECUTE FUNCTION commissioner_monitoring.reject_immutable_monitoring_change();

    CREATE TRIGGER monitoring_office_setups_immutable
    BEFORE UPDATE OR DELETE ON commissioner_monitoring.monitoring_office_setups
    FOR EACH ROW EXECUTE FUNCTION commissioner_monitoring.reject_immutable_monitoring_change();

    CREATE TRIGGER monitoring_opening_balances_immutable
    BEFORE UPDATE OR DELETE ON commissioner_monitoring.monitoring_opening_balances
    FOR EACH ROW EXECUTE FUNCTION commissioner_monitoring.reject_immutable_monitoring_change();
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006063827_InitialCommissionerMonitoring') THEN
    INSERT INTO commissioner_monitoring.__monitoring_ef_migrations_history ("MigrationId", "ProductVersion")
    VALUES ('20261006063827_InitialCommissionerMonitoring', '10.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006065855_EnforceMonitoringAuditAndCorrectionIntegrity') THEN
    ALTER TABLE commissioner_monitoring.monitoring_corrections DROP CONSTRAINT "FK_monitoring_corrections_monitoring_report_entries_EntryId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006065855_EnforceMonitoringAuditAndCorrectionIntegrity') THEN
    DROP INDEX commissioner_monitoring."IX_monitoring_corrections_EntryId";
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006065855_EnforceMonitoringAuditAndCorrectionIntegrity') THEN
    ALTER TABLE commissioner_monitoring.monitoring_report_entries ADD CONSTRAINT "AK_monitoring_report_entries_ReportId_Id" UNIQUE ("ReportId", "Id");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006065855_EnforceMonitoringAuditAndCorrectionIntegrity') THEN
    CREATE INDEX "IX_monitoring_corrections_ReportId_EntryId" ON commissioner_monitoring.monitoring_corrections ("ReportId", "EntryId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006065855_EnforceMonitoringAuditAndCorrectionIntegrity') THEN
    ALTER TABLE commissioner_monitoring.monitoring_corrections ADD CONSTRAINT "FK_monitoring_corrections_monitoring_report_entries_ReportId_E~" FOREIGN KEY ("ReportId", "EntryId") REFERENCES commissioner_monitoring.monitoring_report_entries ("ReportId", "Id") ON DELETE RESTRICT;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006065855_EnforceMonitoringAuditAndCorrectionIntegrity') THEN
    CREATE FUNCTION commissioner_monitoring.reject_report_submission_change()
    RETURNS trigger LANGUAGE plpgsql AS $monitoring$
    BEGIN
        RAISE EXCEPTION 'Monitoring report submission audit fields are immutable';
        RETURN OLD;
    END;
    $monitoring$;

    CREATE TRIGGER monitoring_reports_submission_immutable
    BEFORE UPDATE ON commissioner_monitoring.monitoring_reports
    FOR EACH ROW
    WHEN (OLD."SubmittedByUserId" IS DISTINCT FROM NEW."SubmittedByUserId"
       OR OLD."SubmittedAt" IS DISTINCT FROM NEW."SubmittedAt")
    EXECUTE FUNCTION commissioner_monitoring.reject_report_submission_change();
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261006065855_EnforceMonitoringAuditAndCorrectionIntegrity') THEN
    INSERT INTO commissioner_monitoring.__monitoring_ef_migrations_history ("MigrationId", "ProductVersion")
    VALUES ('20261006065855_EnforceMonitoringAuditAndCorrectionIntegrity', '10.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119094227_AddFieldVisits') THEN
    ALTER TABLE commissioner_monitoring.monitoring_users ADD "Designation" character varying(120);
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119094227_AddFieldVisits') THEN
    ALTER TABLE commissioner_monitoring.monitoring_users ADD "MustChangePassword" boolean NOT NULL DEFAULT FALSE;
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119094227_AddFieldVisits') THEN
    CREATE TABLE commissioner_monitoring.monitoring_field_visits (
        "Id" uuid NOT NULL,
        "OfficeId" uuid NOT NULL,
        "OfficerUserId" uuid NOT NULL,
        "Ward" integer NOT NULL,
        "ServiceId" integer NOT NULL,
        "VisitDate" date NOT NULL,
        "VisitTime" time without time zone NOT NULL,
        "Latitude" double precision NOT NULL,
        "Longitude" double precision NOT NULL,
        "AccuracyMetres" double precision NOT NULL,
        "GpsCapturedAt" timestamp with time zone NOT NULL,
        "ReceivedAt" timestamp with time zone NOT NULL,
        "VerifiedOnSite" boolean NOT NULL,
        "IssueAction" character varying(4000) NOT NULL,
        "PhotoOneKey" character varying(512),
        "PhotoTwoKey" character varying(512),
        "VoidedAt" timestamp with time zone,
        "VoidReason" character varying(1000),
        "VoidedByUserId" uuid,
        CONSTRAINT "PK_monitoring_field_visits" PRIMARY KEY ("Id"),
        CONSTRAINT ck_monitoring_field_visit_accuracy CHECK ("AccuracyMetres" >= 0),
        CONSTRAINT ck_monitoring_field_visit_service CHECK ("ServiceId" BETWEEN 1 AND 25),
        CONSTRAINT ck_monitoring_field_visit_ward CHECK ("Ward" BETWEEN 1 AND 53),
        CONSTRAINT "FK_monitoring_field_visits_monitoring_offices_OfficeId" FOREIGN KEY ("OfficeId") REFERENCES commissioner_monitoring.monitoring_offices ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_monitoring_field_visits_monitoring_users_OfficerUserId" FOREIGN KEY ("OfficerUserId") REFERENCES commissioner_monitoring.monitoring_users ("Id") ON DELETE RESTRICT,
        CONSTRAINT "FK_monitoring_field_visits_monitoring_users_VoidedByUserId" FOREIGN KEY ("VoidedByUserId") REFERENCES commissioner_monitoring.monitoring_users ("Id") ON DELETE RESTRICT
    );
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119094227_AddFieldVisits') THEN
    CREATE INDEX "IX_monitoring_field_visits_OfficeId_VisitDate" ON commissioner_monitoring.monitoring_field_visits ("OfficeId", "VisitDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119094227_AddFieldVisits') THEN
    CREATE INDEX "IX_monitoring_field_visits_OfficerUserId_VisitDate" ON commissioner_monitoring.monitoring_field_visits ("OfficerUserId", "VisitDate");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119094227_AddFieldVisits') THEN
    CREATE INDEX "IX_monitoring_field_visits_VoidedByUserId" ON commissioner_monitoring.monitoring_field_visits ("VoidedByUserId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119094227_AddFieldVisits') THEN
    INSERT INTO commissioner_monitoring.__monitoring_ef_migrations_history ("MigrationId", "ProductVersion")
    VALUES ('20261119094227_AddFieldVisits', '10.0.0');
    END IF;
END $EF$;
COMMIT;

START TRANSACTION;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119101309_AddFieldVisitRequestId') THEN
    ALTER TABLE commissioner_monitoring.monitoring_field_visits ADD "Fingerprint" character varying(64) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119101309_AddFieldVisitRequestId') THEN
    ALTER TABLE commissioner_monitoring.monitoring_field_visits ADD "RequestId" character varying(100) NOT NULL DEFAULT '';
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119101309_AddFieldVisitRequestId') THEN
    CREATE UNIQUE INDEX "IX_monitoring_field_visits_OfficerUserId_RequestId" ON commissioner_monitoring.monitoring_field_visits ("OfficerUserId", "RequestId");
    END IF;
END $EF$;

DO $EF$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM commissioner_monitoring.__monitoring_ef_migrations_history WHERE "MigrationId" = '20261119101309_AddFieldVisitRequestId') THEN
    INSERT INTO commissioner_monitoring.__monitoring_ef_migrations_history ("MigrationId", "ProductVersion")
    VALUES ('20261119101309_AddFieldVisitRequestId', '10.0.0');
    END IF;
END $EF$;
COMMIT;

