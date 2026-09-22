<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Both statements abort rather than repair, which is deliberate.
 *
 * The narrowing fails outright on a row longer than 30 characters, and the
 * index on a pre-existing (owner, name) duplicate. Neither can be there: the
 * only writer so far is POST /api/files, which already validates the length
 * and reuses an owner's existing tag. Truncating with USING LEFT(name, 30)
 * would silently manufacture duplicates and fail on the next statement with
 * a far less readable message.
 *
 * On a populated environment, check first:
 *   SELECT count(*) FROM tag WHERE length(name) > 30;
 *   SELECT owner_id, name FROM tag GROUP BY owner_id, name HAVING count(*) > 1;
 */
final class Version20260922092802 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Cap tag.name at 30 characters and make a tag name unique per owner (#46).';
    }

    public function up(Schema $schema): void
    {
        $this->addSql('ALTER TABLE tag ALTER name TYPE VARCHAR(30)');
        $this->addSql('CREATE UNIQUE INDEX UNIQ_TAG_OWNER_NAME ON tag (owner_id, name)');
    }

    public function down(Schema $schema): void
    {
        $this->addSql('DROP INDEX UNIQ_TAG_OWNER_NAME');
        $this->addSql('ALTER TABLE tag ALTER name TYPE VARCHAR(255)');
    }
}
