defmodule Chat.Repo.Migrations.AddEmojiTagFullTextSearch do
  use Ecto.Migration

  def up do
    alter table(:emoji_tags) do
      add :search_document, :tsvector
    end

    execute("""
    UPDATE emoji_tags AS tag
    SET triggers = source.triggers
    FROM (
      VALUES
        ('вау', ARRAY['ого', 'ничего себе', 'офигеть', 'обалдеть', 'ух ты', '😮', '🤩', '😲']),
        ('восторг', ARRAY['восхищение', 'круто', 'шикарно', 'супер', 'топ', 'кайф', '🔥', '🤩']),
        ('радость', ARRAY['рад', 'рада', 'ура', 'ураа', '🎉', '😁', '🥳']),
        ('счастье', ARRAY['счастлив', 'счастлива', 'кайф', 'блаженство', '😊', '🥰']),
        ('любовь', ARRAY['люблю', 'любим', 'обожаю', 'сердце', '❤️', '💖', '💕']),
        ('смех', ARRAY['смешно', 'ржу', 'ору', 'лол', 'хаха', 'ахаха', '😂', '🤣', '😆']),
        ('хаха', ARRAY['ахаха', 'ха-ха', 'лол', '😂', '🤣']),
        ('улыбка', ARRAY['улыбаюсь', 'улыбнуло', 'улыбнись', '🙂', '😊', '😁']),
        ('грусть', ARRAY['грустно', 'груст', 'печаль', 'печально', '😢', '😔', '☹️']),
        ('печаль', ARRAY['печально', 'грусть', 'тоска', '😢', '😔']),
        ('тоска', ARRAY['тоскливо', 'скучаю', 'скучно', 'уныние', '😞', '😩']),
        ('хнык', ARRAY['плачу', 'плакать', 'слезы', 'слёзы', 'рыдаю', '😭', '😢']),
        ('злость', ARRAY['злюсь', 'бесит', 'раздражает', 'ненавижу', 'злой', 'злая', '🤬', '😡']),
        ('удивление', ARRAY['удивлён', 'удивлена', 'ого', 'ничего себе', 'вот это да', '😮', '😲', '🤯']),
        ('недоумение', ARRAY['не понял', 'не понимаю', 'что происходит', 'чего', 'чё', '🤨', '😕']),
        ('не_понял', ARRAY['не понял', 'не понимаю', 'ничего не понял', 'что это', 'чего', 'чё', '🤔', '🤨']),
        ('одобрение', ARRAY['одобряю', 'верно', 'правильно', 'согласен', 'согласна', 'да', '👍', '👌']),
        ('спасибо', ARRAY['благодарю', 'спс', 'мерси', 'респект', '🙏', '💛']),
        ('привет', ARRAY['здравствуй', 'здравствуйте', 'хай', 'хей', 'доброе утро', 'добрый день', 'добрый вечер', '👋']),
        ('пока', ARRAY['до свидания', 'увидимся', 'до встречи', 'бай', 'прощай', '👋']),
        ('усталость', ARRAY['устал', 'устала', 'вымотан', 'нет сил', 'хочу спать', 'сонно', '😩', '🥱']),
        ('стыд', ARRAY['стыдно', 'неловко', 'позор', 'извините', 'прости', '😳', '🫣']),
        ('страх', ARRAY['страшно', 'боюсь', 'жутко', 'ужас', 'паника', '😱', '😨']),
        ('беспредел', ARRAY['безобразие', 'что творится', 'ужас', 'кошмар', 'бардак', 'абсурд', '🤦', '🤦‍♂️']),
        ('котики', ARRAY['котик', 'кот', 'кошка', 'кошечка', 'мяу', 'мур', '🐱', '😺'])
    ) AS source(name, triggers)
    WHERE tag.name = source.name
    """)

    execute("""
    CREATE FUNCTION emoji_tags_update_search_document() RETURNS trigger AS $$
    BEGIN
      NEW.search_document := to_tsvector('russian', NEW.name || ' ' || array_to_string(NEW.triggers, ' '));
      RETURN NEW;
    END
    $$ LANGUAGE plpgsql
    """)

    execute("""
    CREATE TRIGGER emoji_tags_search_document_trigger
    BEFORE INSERT OR UPDATE OF name, triggers ON emoji_tags
    FOR EACH ROW EXECUTE FUNCTION emoji_tags_update_search_document()
    """)

    execute("UPDATE emoji_tags SET name = name")

    execute(
      "CREATE INDEX emoji_tags_full_text_search_index ON emoji_tags USING gin (search_document)"
    )
  end

  def down do
    execute("DROP INDEX emoji_tags_full_text_search_index")
    execute("DROP TRIGGER emoji_tags_search_document_trigger ON emoji_tags")
    execute("DROP FUNCTION emoji_tags_update_search_document()")

    alter table(:emoji_tags) do
      remove :search_document
    end
  end
end
